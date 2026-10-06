import time

import jwt
import pytest
from fastapi.routing import APIRoute
from httpx import ASGITransport, AsyncClient

from camera_path.api import create_app
from camera_path.config import Settings
from camera_path.dev import library_routes
from camera_path.repositories import ProjectRepository
from camera_path.routers import (
    anchors,
    auth,
    chat,
    library,
    profile,
    project_clouds,
    projects,
    resources,
    scene_points,
    timelines,
    trajectory,
)
from camera_path.routers.auth import require_editor

SECRET = "test-secret-with-at-least-thirty-two-bytes"
PASSWORD = "correct horse battery staple"


@pytest.fixture
async def auth_app(tmp_path):
    repo = ProjectRepository(f"sqlite+aiosqlite:///{tmp_path / 'auth.sqlite3'}")
    await repo.initialize()
    app = create_app(
        Settings(_env_file=None, jwt_secret=SECRET, library_directory=tmp_path / "library"), repo
    )
    await app.state.auth_service.create_editor("leonid", PASSWORD)
    yield app
    await repo.close()


async def sign_in(client):
    result = await client.post(
        "/api/v1/auth/login", json={"username": "leonid", "password": PASSWORD}
    )
    assert result.status_code == 200
    return result.json()["access_token"]


async def test_credentials_write_and_revocation(auth_app):
    async with AsyncClient(transport=ASGITransport(app=auth_app), base_url="http://test") as client:
        for username, password in [("leonid", "wrong"), ("unknown", PASSWORD)]:
            response = await client.post(
                "/api/v1/auth/login", json={"username": username, "password": password}
            )
            assert response.status_code == 401
            assert response.headers["www-authenticate"] == "Bearer"
        token = await sign_in(client)
        headers = {"Authorization": f"Bearer {token}"}
        assert (await client.get("/api/v1/auth/session", headers=headers)).json() == {
            "username": "leonid"
        }
        created = await client.post("/api/v1/projects", json={"name": "Shared"}, headers=headers)
        assert created.status_code == 201
        project_id = created.json()["id"]
        # All shared content remains visible anonymously.
        for url in [
            "/api/v1/projects",
            f"/api/v1/projects/{project_id}",
            f"/api/v1/projects/{project_id}/anchors",
            f"/api/v1/projects/{project_id}/chat/messages",
            f"/api/v1/projects/{project_id}/trajectory/compiled",
            "/api/v1/library",
            "/api/v1/profile/settings",
        ]:
            assert (await client.get(url)).status_code == 200
        patch = {"webgpu_tile_renderer": False, "show_grid": False, "gaussian_dpr": "system"}
        assert (
            await client.patch("/api/v1/profile/settings", json=patch, headers=headers)
        ).json() == patch
        assert (await client.get("/api/v1/profile/settings")).json() == patch
        assert (await client.post("/api/v1/auth/logout", headers=headers)).status_code == 204
        assert (
            await client.post("/api/v1/projects", json={"name": "Denied"}, headers=headers)
        ).status_code == 401
        assert (await client.get("/api/v1/auth/session", headers=headers)).status_code == 401
        assert len((await client.get("/api/v1/projects")).json()) == 1


async def test_every_write_route_authenticates_before_validation(auth_app):
    async with AsyncClient(transport=ASGITransport(app=auth_app), base_url="http://test") as client:
        count = 0
        routers = [
            ("/api/v1", module.router)
            for module in (resources, library, profile, project_clouds, auth, library_routes)
        ]
        routers += [
            ("", module.router)
            for module in (projects, anchors, scene_points, trajectory, timelines, chat)
        ]
        routes = [(prefix, route) for prefix, router in routers for route in router.routes]
        for prefix, route in routes:
            if not isinstance(route, APIRoute) or route.path == "/auth/login":
                continue
            for method in route.methods & {"POST", "PUT", "PATCH", "DELETE"}:
                assert any(dep.call is require_editor for dep in route.dependant.dependencies), (
                    route.path
                )
                path = prefix + route.path
                for parameter in route.param_convertors:
                    path = path.replace("{" + parameter + "}", "missing")
                # Missing bodies, revisions, projects and files must not bypass auth.
                response = await client.request(method, path)
                assert response.status_code == 401, (method, path, response.text)
                count += 1
        assert count > 60  # canonical and legacy routes, local upload, chat and profile


async def test_invalid_expired_and_wrong_algorithm_tokens_are_rejected(auth_app):
    async with AsyncClient(transport=ASGITransport(app=auth_app), base_url="http://test") as client:
        token = await sign_in(client)
        claims = jwt.decode(token, SECRET, algorithms=["HS256"], audience="camera-path-api")
        expired = {**claims, "exp": int(time.time()) - 1}
        future = {**claims, "iat": int(time.time()) + 300}
        no_exp = {key: value for key, value in claims.items() if key != "exp"}
        tokens = [
            "garbage",
            token + "tampered",
            jwt.encode(claims, "other-key" * 4, algorithm="HS256"),
            jwt.encode(expired, SECRET, algorithm="HS256"),
            jwt.encode(future, SECRET, algorithm="HS256"),
            jwt.encode(no_exp, SECRET, algorithm="HS256"),
            jwt.encode(claims, SECRET * 2, algorithm="HS384"),
        ]
        for invalid in tokens:
            response = await client.post(
                "/api/v1/projects",
                json={"name": "Denied"},
                headers={"Authorization": f"Bearer {invalid}"},
            )
            assert response.status_code == 401
        # Resetting the editor password revokes tokens issued with old credentials.
        await auth_app.state.auth_service.create_editor("leonid", PASSWORD)
        assert (
            await client.get("/api/v1/auth/session", headers={"Authorization": f"Bearer {token}"})
        ).status_code == 401


async def test_login_throttling_and_unconfigured_secret(auth_app):
    async with AsyncClient(transport=ASGITransport(app=auth_app), base_url="http://test") as client:
        for _ in range(10):
            assert (
                await client.post(
                    "/api/v1/auth/login", json={"username": "leonid", "password": "wrong"}
                )
            ).status_code == 401
        limited = await client.post(
            "/api/v1/auth/login", json={"username": "leonid", "password": PASSWORD}
        )
        assert limited.status_code == 429
        assert limited.headers["retry-after"] == "60"
        auth_app.state.auth_service.secret = None
        assert (
            await client.post(
                "/api/v1/auth/login", json={"username": "leonid", "password": PASSWORD}
            )
        ).status_code == 503
        assert (await client.get("/api/v1/projects")).status_code == 200
