from asyncio import gather
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from camera_path.config import Settings
from camera_path.persistence.cli_auth import CliDeviceRecord, CliSessionRecord
from camera_path.repositories import ProjectRepository
from camera_path.repositories.auth import AuthRepository
from camera_path.routers.auth import router as editor_router
from camera_path.routers.cli_auth import router as cli_router
from camera_path.services.auth import AuthService
from camera_path.services.cli_auth import DEVICE_TTL_SECONDS, SESSION_TTL_SECONDS, CliAuthService

AUTH = "/api/v1/auth"
CLI = f"{AUTH}/cli"
SECRET = "test-secret-with-at-least-thirty-two-bytes"
PASSWORD = "correct horse battery staple"


@pytest.fixture
async def auth_client(tmp_path, monkeypatch):
    repo = ProjectRepository(f"sqlite+aiosqlite:///{tmp_path / 'cli-auth.sqlite3'}")
    await repo.initialize()
    settings = Settings(_env_file=None, jwt_secret=SECRET, auth_second_factor="off")
    app = FastAPI()
    app.state.auth_service = AuthService(AuthRepository(repo.session_factory), settings)
    app.state.cli_auth_service = CliAuthService(app.state.auth_service, "https://editor.example/")
    app.include_router(editor_router, prefix="/api/v1")
    app.include_router(cli_router, prefix="/api/v1")
    # Reuse a real editor JWT; the adjustable clock starts at real time for JWT iat.
    clock = [app.state.auth_service.now()]
    monkeypatch.setattr(app.state.auth_service, "now", lambda: clock[0])
    await app.state.auth_service.create_editor("editor@example.com", PASSWORD)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://api.example") as cli:
        jwt = (
            await cli.post(
                f"{AUTH}/login", json={"username": "editor@example.com", "password": PASSWORD}
            )
        ).json()["access_token"]
        yield cli, {"Authorization": f"Bearer {jwt}"}, clock, app.state.cli_auth_service
    await repo.close()


async def test_pair_once_and_revoke(auth_client):
    cli, editor, clock, service = auth_client
    resp = await cli.post(f"{CLI}/device")
    assert resp.status_code == 200 and resp.headers["cache-control"] == "no-store"
    challenge = resp.json()
    code = challenge["device_code"]
    user_code = challenge["user_code"]
    url = urlsplit(challenge["verification_uri_complete"])
    assert url.netloc == "editor.example" and url.path == "/cli/authorize"
    assert parse_qs(url.query) == {"user_code": [user_code]}
    assert code not in url.geturl()
    assert challenge["expires_in"] == DEVICE_TTL_SECONDS

    async with service.repository.sessions() as s:
        record = (await s.scalars(select(CliDeviceRecord))).one()
        assert record.device_digest != code
        assert record.user_digest != user_code
    decision = {"user_code": user_code.lower().replace("-", ""), "approve": True}
    assert (await cli.post(f"{CLI}/decision", json=decision)).status_code == 401
    assert (await cli.post(f"{CLI}/token", json={"device_code": code})).json() == {
        "error": "authorization_pending"
    }
    ratelimited = await cli.post(f"{CLI}/token", json={"device_code": code})
    assert ratelimited.json() == {"error": "slow_down"}
    delay = int(ratelimited.headers["retry-after"])
    assert delay == challenge["interval"] + 5

    assert (await cli.post(f"{CLI}/decision", json=decision, headers=editor)).status_code == 204
    assert (await cli.post(f"{CLI}/decision", json=decision, headers=editor)).status_code == 409
    clock[0] += delay
    responses = await gather(
        cli.post(f"{CLI}/token", json={"device_code": code}),
        cli.post(f"{CLI}/token", json={"device_code": code}),
    )
    assert sorted(response.status_code for response in responses) == [200, 400]
    token = next(response.json() for response in responses if response.status_code == 200)
    async with service.repository.sessions() as s:
        worker = (await s.scalars(select(CliSessionRecord))).one()
        assert worker.token_digest != token["access_token"]
        assert worker.worker_id == token["worker_id"]
    assert token["expires_in"] == SESSION_TTL_SECONDS
    assert await service.principal(token["access_token"]) == token["worker_id"]
    worker_headers = {"Authorization": f"Bearer {token['access_token']}"}
    assert (await cli.get(f"{AUTH}/session", headers=worker_headers)).status_code == 401
    assert (await cli.post(f"{CLI}/logout", headers=editor)).status_code == 401
    assert (await cli.post(f"{CLI}/logout", headers=worker_headers)).status_code == 204
    assert (await cli.post(f"{CLI}/logout", headers=worker_headers)).status_code == 401


async def test_deny_expire_and_editor_reset(auth_client):
    cli, editor, clock, service = auth_client
    first = (await cli.post(f"{CLI}/device")).json()
    assert (
        await cli.post(
            f"{CLI}/decision",
            json={"user_code": first["user_code"], "approve": False},
            headers=editor,
        )
    ).status_code == 204
    assert (await cli.post(f"{CLI}/token", json={"device_code": first["device_code"]})).json() == {
        "error": "access_denied"
    }
    second = (await cli.post(f"{CLI}/device")).json()
    assert (
        await cli.post(
            f"{CLI}/decision",
            json={"user_code": second["user_code"], "approve": True},
            headers=editor,
        )
    ).status_code == 204
    token = (await cli.post(f"{CLI}/token", json={"device_code": second["device_code"]})).json()
    assert await service.principal(token["access_token"]) == token["worker_id"]

    third = (await cli.post(f"{CLI}/device")).json()
    await service.editor_auth.create_editor("editor@example.com", PASSWORD)
    assert (await cli.post(f"{CLI}/token", json={"device_code": third["device_code"]})).json() == {
        "error": "expired_token"
    }
    assert (
        await cli.post(
            f"{CLI}/logout", headers={"Authorization": f"Bearer {token['access_token']}"}
        )
    ).status_code == 401
    fourth = (await cli.post(f"{CLI}/device")).json()
    clock[0] += DEVICE_TTL_SECONDS
    assert (await cli.post(f"{CLI}/token", json={"device_code": fourth["device_code"]})).json() == {
        "error": "expired_token"
    }


async def test_worker_session_expires_and_device_rate_limit_is_shared(auth_client):
    cli, editor, clock, service = auth_client
    first = (await cli.post(f"{CLI}/device")).json()
    assert (
        await cli.post(
            f"{CLI}/decision",
            json={"user_code": first["user_code"], "approve": True},
            headers=editor,
        )
    ).status_code == 204
    token = (await cli.post(f"{CLI}/token", json={"device_code": first["device_code"]})).json()
    clock[0] = token["expires_at"] - 1
    assert await service.principal(token["access_token"]) == token["worker_id"]
    clock[0] += 1
    headers = {"Authorization": f"Bearer {token['access_token']}"}
    assert (await cli.post(f"{CLI}/logout", headers=headers)).status_code == 401

    for _ in range(30):
        assert (await cli.post(f"{CLI}/device")).status_code == 200
    limited = await cli.post(f"{CLI}/device", headers={"X-Forwarded-For": "203.0.113.4"})
    assert limited.status_code == 429
    assert limited.headers["retry-after"] == "60"
