from types import SimpleNamespace

from camera_path.agent import TrajectoryAgent
from camera_path.models import LookAtPointAim, Project, ScenePoint
from camera_path.repository import SQLiteProjectRepository
from camera_path.service import TrajectoryService


async def test_agent_persists_conversation_context(monkeypatch, tmp_path) -> None:
    calls = []

    class Responses:
        async def create(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(output=[], output_text=f"answer {len(calls)}")

    monkeypatch.setattr(
        "camera_path.agent.AsyncOpenAI",
        lambda **kwargs: SimpleNamespace(responses=Responses()),
    )
    repository = SQLiteProjectRepository(tmp_path / "state.sqlite3")
    project = await repository.create(Project())
    agent = TrajectoryAgent(TrajectoryService(repository), "test-model", api_key="test")

    first = await agent.handle(project.id, "first request", "message-1")
    second = await agent.handle(project.id, "second request", "message-2")

    assert [item.content for item in second.project.chat_history] == [
        "first request",
        "answer 1",
        "second request",
        "answer 2",
    ]
    assert calls[1]["input"][:2] == [
        {"role": "user", "content": "first request"},
        {"role": "assistant", "content": "answer 1"},
    ]
    assert first.project.revision == 2
    assert second.project.revision == 4


async def test_agent_returns_tool_errors_to_model(monkeypatch, tmp_path) -> None:
    calls = []

    class Responses:
        async def create(self, **kwargs):
            calls.append(kwargs)
            if len(calls) == 1:
                tool_call = SimpleNamespace(
                    type="function_call",
                    name="delete_segment",
                    arguments='{"id":"missing"}',
                    call_id="call-1",
                )
                return SimpleNamespace(output=[tool_call], output_text="")
            return SimpleNamespace(output=[], output_text="Nothing was deleted")

    monkeypatch.setattr(
        "camera_path.agent.AsyncOpenAI",
        lambda **kwargs: SimpleNamespace(responses=Responses()),
    )
    repository = SQLiteProjectRepository(tmp_path / "state.sqlite3")
    project = await repository.create(Project())
    agent = TrajectoryAgent(TrajectoryService(repository), "test-model", api_key="test")

    result = await agent.handle(project.id, "Delete the missing segment", "message-1")

    tool_output = calls[1]["input"][-1]
    assert '"status": "error"' in tool_output["output"]
    assert result.answer == "Nothing was deleted"
    assert result.project.segments == []


async def test_agent_streams_text_and_persists_result(monkeypatch, tmp_path) -> None:
    completed_response = SimpleNamespace(output=[], output_text="hello")

    class Stream:
        def __aiter__(self):
            async def events():
                yield SimpleNamespace(type="response.output_text.delta", delta="hel")
                yield SimpleNamespace(type="response.output_text.delta", delta="lo")
                yield SimpleNamespace(type="response.completed", response=completed_response)

            return events()

    class Responses:
        async def create(self, **kwargs):
            assert kwargs["stream"] is True
            return Stream()

    monkeypatch.setattr(
        "camera_path.agent.AsyncOpenAI",
        lambda **kwargs: SimpleNamespace(responses=Responses()),
    )
    repository = SQLiteProjectRepository(tmp_path / "state.sqlite3")
    project = await repository.create(Project())
    agent = TrajectoryAgent(TrajectoryService(repository), "test-model", api_key="test")

    events = [event async for event in agent.handle_stream(project.id, "Say hello", "message-1")]

    assert events[0] == {"type": "delta", "text": "hel"}
    assert events[1] == {"type": "delta", "text": "lo"}
    assert events[2]["type"] == "result"
    assert events[2]["result"].answer == "hello"


def test_agent_executes_camera_orientation_tools() -> None:
    project = Project()

    default_result = TrajectoryAgent._execute(
        project,
        "set_default_camera_orientation",
        {"yaw_deg": 15, "pitch_deg": -10, "roll_deg": 360},
    )
    created = TrajectoryAgent._execute(
        project,
        "create_camera_orientation_keyframe",
        {
            "path_position": 0.6,
            "yaw_deg": 30,
            "pitch_deg": 5,
            "roll_deg": -2,
            "interpolation_to_next": "linear",
        },
    )
    keyframe_id = created["id"]
    TrajectoryAgent._execute(
        project,
        "update_camera_orientation_keyframe",
        {
            "id": keyframe_id,
            "path_position": 0.4,
            "yaw_deg": None,
            "pitch_deg": 12,
            "roll_deg": None,
            "interpolation_to_next": "hold",
        },
    )

    state = TrajectoryAgent._execute(project, "get_project_state", {})
    item = state["camera_track"]["orientation_keyframes"][keyframe_id]
    assert default_result["status"] == "ok"
    assert state["camera_track"]["default_orientation"]["roll_deg"] == 360
    assert item["path_position"] == 0.4
    assert item["orientation"] == {"yaw_deg": 30.0, "pitch_deg": 12.0, "roll_deg": -2.0}
    assert item["interpolation_to_next"] == "hold"

    TrajectoryAgent._execute(project, "delete_camera_orientation_keyframe", {"id": keyframe_id})
    assert project.camera_track.orientation_keyframes == {}


def test_agent_materializes_whole_path_look_at_as_one_start_keyframe() -> None:
    target = ScenePoint(label="Subject", position=(1, 2, 3))
    project = Project(scene_points={target.id: target})
    arguments = {
        "aim_kind": "look_at_point",
        "scene_point_id": target.id,
        "direction": None,
    }

    first = TrajectoryAgent._execute(project, "set_default_camera_aim", arguments)
    second = TrajectoryAgent._execute(project, "set_default_camera_aim", arguments)

    assert first["id"] == second["id"]
    assert project.camera_track.default_aim.kind == "follow_path"
    assert len(project.camera_track.keyframes) == 1
    keyframe = next(iter(project.camera_track.keyframes.values()))
    assert keyframe.path_position == 0
    assert keyframe.aim == LookAtPointAim(scene_point_id=target.id)
