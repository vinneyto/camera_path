from httpx import ASGITransport, AsyncClient

from camera_path.api import app


async def test_project_edit_compile_and_undo() -> None:
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


async def test_missing_anchor_is_rejected() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        project = (await client.post("/projects", json={})).json()
        response = await client.post(
            f"/projects/{project['id']}/segments/spline",
            json={"anchor_ids": ["missing-a", "missing-b"]},
        )
        assert response.status_code == 422


async def test_chat_requires_api_key(monkeypatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        project = (await client.post("/projects", json={})).json()
        response = await client.post(
            f"/projects/{project['id']}/chat/messages",
            json={"message": "Create a path"},
        )
        assert response.status_code == 503
        assert "OPENAI_API_KEY" in response.json()["detail"]
