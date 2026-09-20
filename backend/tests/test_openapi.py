import json
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from camera_path.api import create_app
from camera_path.config import Settings
from camera_path.export_openapi import export_schema
from camera_path.repositories import ProjectRepository


@pytest.fixture
def app(tmp_path):
    database_url = f"sqlite+aiosqlite:///{tmp_path / 'openapi.sqlite3'}"
    settings = Settings(_env_file=None, database_url=database_url)
    return create_app(settings, ProjectRepository(database_url))


async def test_scalar_replaces_builtin_documentation(app) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/docs")
        schema_response = await client.get("/api/v1/openapi.json")
        redoc_response = await client.get("/redoc")

    assert response.status_code == 200
    assert "scalar" in response.text.lower()
    assert schema_response.status_code == 200
    assert redoc_response.status_code == 404


async def test_openapi_contains_only_canonical_business_routes(app) -> None:
    schema = app.openapi()
    assert schema["paths"]
    assert all(path.startswith("/api/v1/") for path in schema["paths"])
    assert "/api/v1/projects/{project_id}/camera/depth-of-field/keyframes" in schema["paths"]
    assert "/projects" not in schema["paths"]
    assert "/health" not in schema["paths"]

    operations = [
        operation
        for path_item in schema["paths"].values()
        for method, operation in path_item.items()
        if method in {"get", "post", "patch", "delete"}
    ]
    operation_ids = [operation["operationId"] for operation in operations]
    assert len(operation_ids) == len(set(operation_ids))
    assert all(operation.get("tags") for operation in operations)
    assert all(operation.get("summary") for operation in operations)
    assert all(operation.get("description") for operation in operations)


async def test_openapi_describes_concurrency_errors_unions_and_sse(app) -> None:
    schema = app.openapi()
    mutation = schema["paths"]["/api/v1/projects/{project_id}/anchors"]["post"]
    if_match = next(item for item in mutation["parameters"] if item["name"] == "If-Match")
    assert if_match["required"] is True
    assert mutation["responses"]["200"]["headers"]["ETag"]
    assert mutation["responses"]["409"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ErrorResponse"
    }

    aim = schema["components"]["schemas"]["CameraKeyframeCreate"]["properties"]["aim"]
    assert aim["discriminator"]["propertyName"] == "kind"
    focus = schema["components"]["schemas"]["DepthOfFieldKeyframeCreate"]["properties"]["focus"]
    assert focus["discriminator"]["propertyName"] == "kind"

    stream = schema["paths"]["/api/v1/projects/{project_id}/chat/messages/stream"]["post"]
    assert "text/event-stream" in stream["responses"]["200"]["content"]
    assert all(event in stream["description"] for event in ("delta", "result", "error"))


async def test_versioned_routes_use_etag_and_if_match_while_legacy_routes_do_not(app) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        created = await client.post("/api/v1/projects", json={"name": "Versioned"})
        project_id = created.json()["id"]
        assert created.headers["etag"] == '"0"'

        missing = await client.post(
            f"/api/v1/projects/{project_id}/anchors",
            json={"label": "A", "surface_position": [0, 0, 0]},
        )
        assert missing.status_code == 428
        assert missing.json()["code"] == "if_match_required"

        updated = await client.post(
            f"/api/v1/projects/{project_id}/anchors",
            headers={"If-Match": created.headers["etag"]},
            json={"label": "A", "surface_position": [0, 0, 0]},
        )
        assert updated.status_code == 200
        assert updated.headers["etag"] == '"1"'

        stale = await client.patch(
            f"/api/v1/projects/{project_id}",
            headers={"If-Match": '"0"'},
            json={"name": "Stale"},
        )
        assert stale.status_code == 409
        assert stale.json()["code"] == "revision_conflict"

        legacy = await client.patch(
            f"/projects/{project_id}",
            json={"name": "Legacy"},
        )
        assert legacy.status_code == 200
        assert legacy.json()["name"] == "Legacy"

        current = await client.get(f"/api/v1/projects/{project_id}")
        assert current.headers["etag"] == f'"{current.json()["revision"]}"'


async def test_versioned_errors_follow_error_response_schema(app) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/projects", json={"name": ""})

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert body["detail"] == "Request validation failed"
    assert body["field_errors"][0]["location"] == ["body", "name"]


def test_exported_schema_is_generated_from_the_application(app, tmp_path) -> None:
    destination = tmp_path / "openapi.json"
    export_schema(destination)
    assert json.loads(destination.read_text()) == app.openapi()


def test_checked_in_schema_is_current(app) -> None:
    assert json.loads(Path("openapi.json").read_text(encoding="utf-8")) == app.openapi()
