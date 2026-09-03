import pytest
from httpx import ASGITransport, AsyncClient

from camera_path.api import create_app
from camera_path.config import Settings
from camera_path.models import ChatHistoryMessage, ChatResult, ProjectCreate
from camera_path.repository import SQLiteProjectRepository


@pytest.fixture
def app(tmp_path):
    settings = Settings(_env_file=None, database_path=tmp_path / "api.sqlite3")
    return create_app(settings, SQLiteProjectRepository(settings.database_path))


async def test_frontend_origin_is_allowed(app) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.options(
            "/projects",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


async def test_project_edit_compile_and_undo(app) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/projects", json={"name": "Demo"})
        assert response.status_code == 201
        project = response.json()

        anchor_ids = []
        for label, position in [("A", [0, 0, 0]), ("B", [1, 1, 0]), ("C", [2, 0, 0])]:
            response = await client.post(
                f"/projects/{project['id']}/anchors",
                json={"label": label, "surface_position": position},
            )
            assert response.status_code == 200
            anchor_ids.append(
                next(
                    item
                    for item, value in response.json()["anchors"].items()
                    if value["label"] == label
                )
            )

        response = await client.post(
            f"/projects/{project['id']}/segments/spline",
            json={"anchor_ids": anchor_ids, "tension": 0.0},
        )
        assert response.status_code == 200
        assert len(response.json()["segments"]) == 1

        response = await client.get(f"/projects/{project['id']}/trajectory/compiled")
        assert response.status_code == 200
        assert len(response.json()["position_segments"]) == 2

        response = await client.post(f"/projects/{project['id']}/undo")
        assert response.status_code == 200
        assert response.json()["segments"] == []

        response = await client.post(f"/projects/{project['id']}/redo")
        assert len(response.json()["segments"]) == 1

        projects = (await client.get("/projects")).json()
        assert any(item["id"] == project["id"] for item in projects)


async def test_missing_anchor_is_rejected(app) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        project = (await client.post("/projects", json={})).json()
        response = await client.post(
            f"/projects/{project['id']}/segments/spline",
            json={"anchor_ids": ["missing-a", "missing-b"]},
        )
        assert response.status_code == 422


async def test_anchor_can_be_lifted_after_creation(app) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        project = (await client.post("/projects", json={})).json()
        project = (
            await client.post(
                f"/projects/{project['id']}/anchors",
                json={"label": "A", "surface_position": [1, 2, 3]},
            )
        ).json()
        anchor_id = next(iter(project["anchors"]))

        response = await client.patch(
            f"/projects/{project['id']}/anchors/{anchor_id}", json={"lift": 4}
        )

        assert response.status_code == 200
        assert response.json()["anchors"][anchor_id]["surface_position"] == [1.0, 2.0, 3.0]
        assert response.json()["anchors"][anchor_id]["lift"] == 4.0


async def test_chat_requires_api_key(app) -> None:
    app.state.trajectory_agent.api_key = None
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        project = (await client.post("/projects", json={})).json()
        response = await client.post(
            f"/projects/{project['id']}/chat/messages",
            json={"message": "Create a path"},
        )
        assert response.status_code == 503
        assert "OPENAI_API_KEY" in response.json()["detail"]


async def test_client_can_edit_speed_and_camera_graphs(app) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        project = (await client.post("/projects", json={"name": "Controls"})).json()
        project_id = project["id"]

        point_response = await client.post(
            f"/projects/{project_id}/scene-points",
            json={"label": "Subject", "position": [4, 5, 6]},
        )
        assert point_response.status_code == 200
        point_id = next(iter(point_response.json()["scene_points"]))

        speed_response = await client.post(
            f"/projects/{project_id}/motion/keyframes",
            json={
                "path_position": 0.4,
                "speed": 0.25,
                "interpolation_to_next": "smoothstep",
            },
        )
        assert speed_response.status_code == 200
        speed_id = next(iter(speed_response.json()["motion_profile"]["keyframes"]))

        camera_response = await client.post(
            f"/projects/{project_id}/camera/keyframes",
            json={
                "path_position": 0.5,
                "aim": {"kind": "look_at_point", "scene_point_id": point_id},
                "interpolation_to_next": "linear",
            },
        )
        assert camera_response.status_code == 200
        camera_id = next(iter(camera_response.json()["camera_track"]["keyframes"]))

        compiled = (await client.get(f"/projects/{project_id}/trajectory/compiled")).json()
        assert compiled["motion_profile"]["keyframes"][0]["speed"] == 0.25
        assert compiled["camera_track"]["keyframes"][0]["aim"]["position"] == [4.0, 5.0, 6.0]

        assert (
            await client.delete(f"/projects/{project_id}/scene-points/{point_id}")
        ).status_code == 409
        assert (
            await client.delete(
                f"/projects/{project_id}/scene-points/{point_id}", params={"cascade": True}
            )
        ).status_code == 200
        project = (
            await client.delete(f"/projects/{project_id}/motion/keyframes/{speed_id}")
        ).json()
        assert project["motion_profile"]["keyframes"] == {}
        assert camera_id not in project["camera_track"]["keyframes"]


async def test_duplicate_graph_positions_are_rejected(app) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        project = (await client.post("/projects", json={})).json()
        url = f"/projects/{project['id']}/motion/keyframes"
        payload = {"path_position": 0.5, "speed": 1.0}
        assert (await client.post(url, json=payload)).status_code == 200
        assert (await client.post(url, json=payload)).status_code == 422


async def test_client_can_change_default_speed_and_aim(app) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        project = (await client.post("/projects", json={})).json()
        project_id = project["id"]
        point_project = (
            await client.post(
                f"/projects/{project_id}/scene-points",
                json={"label": "Target", "position": [0, 1, 0]},
            )
        ).json()
        point_id = next(iter(point_project["scene_points"]))

        motion = await client.patch(f"/projects/{project_id}/motion", json={"default_speed": 3.0})
        camera = await client.patch(
            f"/projects/{project_id}/camera",
            json={"default_aim": {"kind": "look_at_point", "scene_point_id": point_id}},
        )

        assert motion.status_code == 200
        assert motion.json()["motion_profile"]["default_speed"] == 3.0
        assert camera.status_code == 200
        assert camera.json()["camera_track"]["default_aim"]["scene_point_id"] == point_id


async def test_project_lifecycle_endpoints(app) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        project = (await client.post("/projects", json={"name": "Before"})).json()
        project_id = project["id"]
        project = (
            await client.post(
                f"/projects/{project_id}/anchors",
                json={"label": "A", "surface_position": [0, 0, 0]},
            )
        ).json()

        renamed = await client.patch(f"/projects/{project_id}", json={"name": "After"})
        assert renamed.status_code == 200
        assert renamed.json()["name"] == "After"

        draft = await app.state.trajectory_service.get_project(project_id)
        draft.chat_history.append(ChatHistoryMessage(role="user", content="Old context"))
        await app.state.trajectory_service.commit_draft(draft, draft.revision)
        cleared_chat = await client.delete(f"/projects/{project_id}/chat")
        assert cleared_chat.status_code == 200
        assert cleared_chat.json()["chat_history"] == []

        reset = await client.post(f"/projects/{project_id}/reset")
        assert reset.status_code == 200
        assert reset.json()["id"] == project_id
        assert reset.json()["name"] == "After"
        assert reset.json()["anchors"] == {}

        deleted = await client.delete(f"/projects/{project_id}")
        assert deleted.status_code == 204
        assert (await client.get(f"/projects/{project_id}")).status_code == 404


async def test_clear_trajectory_preserves_scene_setup(app) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        project = (await client.post("/projects", json={})).json()
        project_id = project["id"]
        for label, position in (("A", [0, 0, 0]), ("B", [1, 0, 0])):
            project = (
                await client.post(
                    f"/projects/{project_id}/anchors",
                    json={"label": label, "surface_position": position},
                )
            ).json()
        anchor_ids = list(project["anchors"])
        await client.post(
            f"/projects/{project_id}/segments/spline",
            json={"anchor_ids": anchor_ids},
        )

        cleared = await client.delete(f"/projects/{project_id}/trajectory")

        assert cleared.status_code == 200
        assert set(cleared.json()["anchors"]) == set(anchor_ids)
        assert cleared.json()["segments"] == []
        assert cleared.json()["motion_profile"]["keyframes"] == {}
        assert cleared.json()["camera_track"]["keyframes"] == {}


async def test_chat_stream_uses_sse_delta_and_result_events(app) -> None:
    service = app.state.trajectory_service
    project = await service.create_project(ProjectCreate(name="Streaming"))
    result = ChatResult(
        answer="hello",
        project=project,
        compiled=service.compile_draft(project),
    )

    class FakeAgent:
        def ensure_available(self) -> None:
            pass

        async def handle_stream(self, project_id: str, message: str):
            assert project_id == project.id
            assert message == "Say hello"
            yield {"type": "delta", "text": "hel"}
            yield {"type": "delta", "text": "lo"}
            yield {"type": "result", "result": result}

    app.state.trajectory_agent = FakeAgent()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            f"/projects/{project.id}/chat/messages/stream",
            json={"message": "Say hello"},
        )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert 'event: delta\ndata: {"text": "hel"}' in response.text
    assert "event: result\n" in response.text
