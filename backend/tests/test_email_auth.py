import asyncio
import time

import jwt
import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from sqlalchemy import select
from test_auth import PASSWORD, SECRET

from camera_path.api import create_app
from camera_path.config import Settings
from camera_path.persistence.models import AuthChallengeRecord, EditorSessionRecord
from camera_path.repositories import ProjectRepository
from camera_path.repositories.auth import AuthRepository
from camera_path.services.auth import AuthService
from camera_path.services.auth_email import AuthEmailError

EMAIL = "leonid@example.com"


class Mailbox:
    def __init__(self):
        self.messages = []
        self.fail = False

    async def send_code(self, recipient, code):
        if self.fail:
            raise AuthEmailError("not delivered")
        self.messages.append((recipient, code))


@pytest.fixture
async def email_app(tmp_path):
    repo = ProjectRepository(f"sqlite+aiosqlite:///{tmp_path / 'email.sqlite3'}")
    await repo.initialize()
    settings = Settings(_env_file=None, jwt_secret=SECRET, library_directory=tmp_path / "library")
    app = create_app(settings, repo)
    mailbox = Mailbox()
    service = AuthService(AuthRepository(repo.session_factory), settings, mailbox)
    app.state.auth_service = service
    fixed_now = int(time.time())
    service.now = lambda: fixed_now
    await service.create_editor(EMAIL.upper(), PASSWORD)
    yield app, service, mailbox, settings
    await repo.close()


async def test_password_is_only_a_challenge_and_code_is_single_use(email_app):
    app, service, mailbox, _ = email_app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login", json={"username": EMAIL, "password": PASSWORD}
        )
        assert login.status_code == 200
        result = login.json()
        assert "access_token" not in result
        assert result["expires_in"] == 300 and result["resend_after"] == 60
        assert mailbox.messages[0][0] == EMAIL
        code = mailbox.messages[0][1]
        assert len(code) == 6 and code.isdigit()
        async with service.repository.sessions() as session:
            challenge = await session.get(AuthChallengeRecord, result["challenge_id"])
            assert code not in challenge.code_digest
            assert len(challenge.code_digest) == 64
            assert list(await session.scalars(select(EditorSessionRecord))) == []
        assert (await client.post("/api/v1/projects", json={"name": "denied"})).status_code == 401
        # Challenge IDs are not bearer credentials either.
        assert (
            await client.get(
                "/api/v1/auth/session",
                headers={"Authorization": f"Bearer {result['challenge_id']}"},
            )
        ).status_code == 401
        verify = await client.post(
            "/api/v1/auth/verify", json={"challenge_id": result["challenge_id"], "code": code}
        )
        token = verify.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        assert (await client.get("/api/v1/auth/session", headers=headers)).json() == {
            "username": EMAIL
        }
        assert (
            await client.post(
                "/api/v1/auth/verify", json={"challenge_id": result["challenge_id"], "code": code}
            )
        ).status_code == 401
        assert (await client.post("/api/v1/auth/logout", headers=headers)).status_code == 204
        assert (await client.get("/api/v1/auth/session", headers=headers)).status_code == 401


async def test_resend_replaces_code_preserves_attempts_and_survives_restart(email_app):
    _, service, mailbox, settings = email_app
    clock = [int(time.time())]
    service.now = lambda: clock[0]
    result = await service.login(EMAIL, PASSWORD)
    first = mailbox.messages[-1][1]
    # Wrong code always consumes an attempt.
    wrong = "000000" if first != "000000" else "111111"
    with pytest.raises(HTTPException) as error:
        await service.verify(result["challenge_id"], wrong, "peer")
    assert error.value.status_code == 401
    with pytest.raises(HTTPException) as error:
        await service.resend(result["challenge_id"], "peer")
    assert error.value.status_code == 429
    clock[0] += 61
    await service.resend(result["challenge_id"], "peer")
    second = mailbox.messages[-1][1]
    # A new service/process sees the same persisted attempt count and replaced HMAC.
    restarted = AuthService(service.repository, settings, mailbox)
    restarted.now = service.now
    with pytest.raises(HTTPException):
        await restarted.verify(result["challenge_id"], first, "peer")
    async with service.repository.sessions() as session:
        assert (await session.get(AuthChallengeRecord, result["challenge_id"])).attempts == 2
    verified = await restarted.verify(result["challenge_id"], second, "peer")
    assert "access_token" in verified


async def test_lockout_cannot_be_reset_by_resend_or_process_restart(email_app):
    _, service, mailbox, settings = email_app
    result = await service.login(EMAIL, PASSWORD)
    code = mailbox.messages[-1][1]
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        with pytest.raises(HTTPException):
            await service.verify(result["challenge_id"], wrong, "peer")
    service = AuthService(service.repository, settings, mailbox)
    for operation in [
        service.verify(result["challenge_id"], code, "peer"),
        service.resend(result["challenge_id"], "peer"),
    ]:
        with pytest.raises(HTTPException) as error:
            await operation
        assert error.value.status_code == 401


async def test_expiry_delivery_failure_and_credential_replacement(email_app):
    _, service, mailbox, _ = email_app
    result = await service.login(EMAIL, PASSWORD)
    code = mailbox.messages[-1][1]
    clock = service.now() + 301
    service.now = lambda: clock
    with pytest.raises(HTTPException):
        await service.verify(result["challenge_id"], code, "peer")
    mailbox.fail = True
    with pytest.raises(HTTPException) as error:
        await service.login(EMAIL, PASSWORD)
    assert error.value.status_code == 503
    async with service.repository.sessions() as session:
        assert list(await session.scalars(select(EditorSessionRecord))) == []
        challenges = list(await session.scalars(select(AuthChallengeRecord)))
        assert all(not c.delivered for c in challenges)
    mailbox.fail = False
    result = await service.login(EMAIL, PASSWORD)
    code = mailbox.messages[-1][1]
    await service.create_editor(EMAIL, PASSWORD)
    with pytest.raises(HTTPException):
        await service.verify(result["challenge_id"], code, "peer")


async def test_concurrent_confirmation_only_issues_one_session_across_services(email_app):
    _, service, mailbox, settings = email_app
    result = await service.login(EMAIL, PASSWORD)
    other = AuthService(service.repository, settings, mailbox)
    outcomes = await asyncio.gather(
        *[
            s.verify(result["challenge_id"], mailbox.messages[-1][1], "peer")
            for s in (service, other)
        ],
        return_exceptions=True,
    )
    assert sum(isinstance(r, dict) for r in outcomes) == 1
    assert sum(isinstance(r, HTTPException) for r in outcomes) == 1
    async with service.repository.sessions() as session:
        assert len(list(await session.scalars(select(EditorSessionRecord)))) == 1


async def test_persistent_limits_and_email_validation(email_app):
    _, service, mailbox, settings = email_app
    for _ in range(10):
        with pytest.raises(HTTPException) as error:
            await service.login(EMAIL, "wrong", "peer")
        assert error.value.status_code == 401
    restarted = AuthService(service.repository, settings, mailbox)
    with pytest.raises(HTTPException) as error:
        await restarted.login(EMAIL, PASSWORD, "forged-different-peer")
    assert error.value.status_code == 429
    with pytest.raises(ValueError, match="email"):
        await service.create_editor("not-an-email", PASSWORD)


async def test_off_is_explicit_and_password_only_tokens_fail_in_email_mode(email_app):
    _, service, mailbox, settings = email_app
    off = AuthService(service.repository, settings.model_copy(update={"auth_second_factor": "off"}))
    token = (await off.login(EMAIL, PASSWORD))["access_token"]
    assert mailbox.messages == [] and off.sender is None
    assert (
        jwt.decode(token, SECRET, algorithms=["HS256"], audience="camera-path-api")["amr"] == "off"
    )
    with pytest.raises(HTTPException):
        await service.principal(token)


@pytest.mark.parametrize(
    "override",
    [
        {"auth_second_factor": "off", "auth_email_delivery": "ses"},
        {"auth_second_factor": "email", "auth_email_delivery": "smtp"},
    ],
)
def test_production_cannot_disable_or_mock_second_factor(override):
    with pytest.raises(ValidationError, match="Production requires"):
        Settings(_env_file=None, environment="production", **override)


async def test_failed_resend_invalidates_previous_code_without_resetting_attempts(email_app):
    _, service, mailbox, _ = email_app
    clock = [int(time.time())]
    service.now = lambda: clock[0]
    challenge = await service.login(EMAIL, PASSWORD)
    code = mailbox.messages[-1][1]
    clock[0] += 61
    mailbox.fail = True
    with pytest.raises(HTTPException) as error:
        await service.resend(challenge["challenge_id"], "peer")
    assert error.value.status_code == 503
    with pytest.raises(HTTPException):
        await service.verify(challenge["challenge_id"], code, "peer")


async def test_parallel_resends_reserve_cooldown_once(email_app):
    _, service, mailbox, settings = email_app
    challenge = await service.login(EMAIL, PASSWORD)
    now = service.now() + 61
    other = AuthService(service.repository, settings, mailbox)
    service.now = other.now = lambda: now
    outcomes = await asyncio.gather(
        *[s.resend(challenge["challenge_id"], "peer") for s in (service, other)],
        return_exceptions=True,
    )
    assert sum(isinstance(r, dict) for r in outcomes) == 1
    assert sum(isinstance(r, HTTPException) and r.status_code == 429 for r in outcomes) == 1
    assert len(mailbox.messages) == 2


async def test_ses_adapter_shapes_message_and_maps_failure_without_network(monkeypatch):
    from unittest.mock import Mock

    import boto3
    from botocore.exceptions import ClientError

    from camera_path.aws.auth_email import SesAuthEmailSender

    client = Mock()
    session = Mock()
    session.client.return_value = client
    factory = Mock(return_value=session)
    monkeypatch.setattr(boto3, "Session", factory)
    sender = SesAuthEmailSender(
        Settings(_env_file=None, auth_email_delivery="ses", aws_region="us-east-1")
    )
    await sender.send_code(EMAIL, "123456")
    args = client.send_email.call_args.kwargs
    assert args["Destination"] == {"ToAddresses": [EMAIL]}
    assert args["FromEmailAddress"] == "noreply@camerapath.dev"
    assert "123456" in args["Content"]["Simple"]["Body"]["Text"]["Data"]
    assert factory.call_args.kwargs["region_name"] == "us-east-1"
    client.send_email.side_effect = ClientError({"Error": {"Code": "MessageRejected"}}, "SendEmail")
    with pytest.raises(AuthEmailError):
        await sender.send_code(EMAIL, "123456")
