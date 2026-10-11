import json
from types import SimpleNamespace

import pytest

from camera_path.agent import TrajectoryAgent
from camera_path.models import Anchor, Project, SpeedKeyframe, SpiralSegment
from camera_path.repositories import ProjectRepository
from camera_path.services import ChatService, TrajectoryService


def test_lidar_defaults_partial_updates_and_singleton_identity():
    project = Project()
    TrajectoryAgent._execute(
        project,
        "set_lidar_timeline",
        {"vertical_fov_deg": None, "horizontal_resolution": None, "vertical_resolution": None},
    )
    first = project.camera_track.lidar_keyframe
    assert first.path_position == 0
    assert (first.vertical_fov_deg, first.horizontal_resolution, first.vertical_resolution) == (
        60,
        512,
        32,
    )
    TrajectoryAgent._execute(
        project,
        "set_lidar_timeline",
        {"vertical_fov_deg": 90, "horizontal_resolution": None, "vertical_resolution": 64},
    )
    updated = project.camera_track.lidar_keyframe
    assert updated.id == first.id
    assert updated.path_position == 0
    assert updated.horizontal_resolution == 512
    assert updated.vertical_fov_deg == 90
    assert updated.vertical_resolution == 64
    state = TrajectoryAgent._execute(project, "get_project_state", {})
    assert state["camera_track"]["lidar_keyframe"] == updated.model_dump()


@pytest.mark.parametrize(
    "arguments",
    [
        {"vertical_fov_deg": 180},
        {"vertical_fov_deg": float("nan")},
        {"horizontal_resolution": 4097},
        {"vertical_resolution": 1.5},
        {"path_position": 0.5},
        {"id": "invented"},
    ],
)
def test_bad_lidar_tool_arguments_leave_draft_unchanged(arguments):
    project = Project()
    TrajectoryAgent._execute(project, "set_lidar_timeline", {})
    before = project.model_dump()
    result, output = TrajectoryAgent._try_execute(
        project, "set_lidar_timeline", json.dumps(arguments)
    )
    assert output["status"] == "error"
    assert result is project
    assert project.model_dump() == before


@pytest.mark.parametrize("streaming", [False, True])
async def test_chat_lidar_tools_are_advertised_and_persist_without_changing_other_tracks(
    monkeypatch, tmp_path, streaming
):
    responses = []

    class Stream:
        def __init__(self, response):
            self.response = response

        def __aiter__(self):
            async def events():
                yield SimpleNamespace(type="response.completed", response=self.response)

            return events()

    class Responses:
        async def create(self, **kwargs):
            advertised = {tool["name"]: tool for tool in kwargs["tools"]}
            assert "set_lidar_timeline" in advertised
            assert "delete_lidar_timeline" in advertised
            schema = advertised["set_lidar_timeline"]["parameters"]
            assert set(schema["required"]) == set(schema["properties"])
            assert "path_position" not in schema["properties"]
            response = responses.pop(0)
            return Stream(response) if kwargs.get("stream") else response

    monkeypatch.setattr(
        "camera_path.agent.trajectory_agent.AsyncOpenAI",
        lambda **kwargs: SimpleNamespace(responses=Responses()),
    )
    repository = ProjectRepository(f"sqlite+aiosqlite:///{tmp_path / 'agent-lidar.sqlite3'}")
    try:
        project = Project()
        start = Anchor(label="Start", surface_position=(1, 0, 0))
        center = Anchor(label="Center", surface_position=(0, 0, 0))
        end = Anchor(label="End", surface_position=(2, 2, 0))
        project.anchors = {anchor.id: anchor for anchor in (start, center, end)}
        project.segments = [
            SpiralSegment(
                start_anchor_id=start.id, center_anchor_id=center.id, end_anchor_id=end.id
            )
        ]
        speed = SpeedKeyframe(path_position=0.5, speed=2)
        project.motion_profile.keyframes[speed.id] = speed
        project = await repository.create(project)
        agent = TrajectoryAgent(
            repository, TrajectoryService(repository), ChatService(repository), "test", "test"
        )

        async def turn(name, arguments, message_id):
            responses.extend(
                [
                    SimpleNamespace(
                        output=[
                            SimpleNamespace(
                                type="function_call",
                                name=name,
                                arguments=json.dumps(arguments),
                                call_id=message_id,
                            )
                        ],
                        output_text="",
                    ),
                    SimpleNamespace(output=[], output_text="LiDAR updated"),
                ]
            )
            if streaming:
                events = [
                    event async for event in agent.handle_stream(project.id, name, message_id)
                ]
                assert events[-1]["type"] == "result"
            else:
                await agent.handle(project.id, name, message_id)
            reloaded = await repository.get(project.id)
            assert reloaded.anchors == project.anchors
            assert reloaded.segments == project.segments
            assert reloaded.motion_profile == project.motion_profile
            return reloaded.camera_track.lidar_keyframe

        created = await turn(
            "set_lidar_timeline",
            {"vertical_fov_deg": 60, "horizontal_resolution": 512, "vertical_resolution": 32},
            "enable",
        )
        assert created is not None
        assert created.path_position == 0
        updated = await turn(
            "set_lidar_timeline",
            {"vertical_fov_deg": None, "horizontal_resolution": 1024, "vertical_resolution": None},
            "configure",
        )
        assert updated.id == created.id
        assert updated.horizontal_resolution == 1024
        assert updated.vertical_resolution == 32
        assert await turn("delete_lidar_timeline", {}, "disable") is None
    finally:
        await repository.close()
