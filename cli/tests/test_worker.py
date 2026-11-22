import hashlib
import json
from uuid import uuid4

import httpx
import pytest

from camera_path_cli.main import Profile, login
from camera_path_cli.worker import InferenceConnection, save_json

JOB, ATTEMPT, UPLOAD = (str(uuid4()) for _ in range(3))
PROFILE = Profile("dev", "http://127.0.0.1:3000", "http://127.0.0.1:8000/api/v1")


class FakePainter:
    async def run(self, command, attempt, parameters, out):
        assert (command, attempt, parameters) == ("generate_image", ATTEMPT, {"prompt": "test"})
        directory = out / attempt
        directory.mkdir()
        (directory / "image.png").write_bytes(b"fake PNG")
        return {"status": "succeeded"}


async def test_claim_upload_and_complete_retries(tmp_path):
    claims, completed, uploads = [], [], []
    signed = "https://bucket.s3.example/one?signature=fake"

    async def handle(request):
        path = request.url.path
        if path.endswith("/claim"):
            claims.append(json.loads(request.content))
            if len(claims) == 1:
                raise httpx.ReadError("claim response lost", request=request)
            return httpx.Response(
                200,
                json={
                    "command": "generate_image",
                    "attempt_id": ATTEMPT,
                    "input": {"prompt": "test"},
                },
            )
        if path.endswith("/heartbeat"):
            return httpx.Response(200, json={})
        if request.method == "POST" and path.endswith("/uploads"):
            (file,) = json.loads(request.content)["files"]
            assert file["sha256"] == hashlib.sha256(b"fake PNG").hexdigest()
            return httpx.Response(
                200,
                json={
                    "files": [
                        {
                            "file_id": file["file_id"],
                            "upload_id": UPLOAD,
                            "upload_url": signed,
                            "headers": {"Content-Length": "8"},
                        }
                    ]
                },
            )
        if request.method == "PUT":
            uploads.append(await request.aread())
            assert str(request.url) == signed
            assert "Authorization" not in request.headers
            return httpx.Response(200)
        if path.endswith("/complete"):
            completed.append(json.loads(request.content))
            if len(completed) == 1:
                raise httpx.ReadError("complete response lost", request=request)
            return httpx.Response(200, json={"status": "succeeded"})
        raise AssertionError(path)

    async with httpx.AsyncClient(
        base_url=PROFILE.api, transport=httpx.MockTransport(handle)
    ) as http:
        await InferenceConnection(PROFILE, "worker", http, FakePainter(), tmp_path).process(
            {"job_id": JOB, "command": "generate_image"}
        )
    assert len(claims) == 2 and claims[0] == claims[1]
    assert uploads == [b"fake PNG"]
    assert completed == [{"attempt_id": ATTEMPT, "image_upload_id": UPLOAD}] * 2
    assert list(tmp_path.iterdir()) == []


async def test_worker_restart_replays_saved_complete(tmp_path):
    body = {"attempt_id": ATTEMPT, "image_upload_id": UPLOAD}
    save_json(
        tmp_path / "pending.json",
        {
            "job_id": JOB,
            "claim_id": str(uuid4()),
            "attempt": {"attempt_id": ATTEMPT, "command": "generate_image", "input": {}},
        },
    )
    directory = tmp_path / JOB
    directory.mkdir()
    save_json(directory / f"{ATTEMPT}.receipt.json", {"manifest": body})

    def handle(request):
        assert request.url.path.endswith("/complete")
        assert json.loads(request.content) == body
        return httpx.Response(200, json={"status": "succeeded"})

    async with httpx.AsyncClient(
        base_url=PROFILE.api, transport=httpx.MockTransport(handle)
    ) as http:
        await InferenceConnection(PROFILE, "worker", http, object(), tmp_path).process(
            {"job_id": JOB}
        )
    assert list(tmp_path.iterdir()) == []


async def test_source_refuses_other_origins(tmp_path):
    async with httpx.AsyncClient(
        base_url=PROFILE.api,
        transport=httpx.MockTransport(
            lambda req: pytest.fail(f"unexpected request to {req.url.host}")
        ),
    ) as http:
        connection = InferenceConnection(PROFILE, "worker", http, object(), tmp_path)
        with pytest.raises(ValueError, match="outside this job"):
            await connection.transfer_source(
                JOB, ATTEMPT, "https://elsewhere.example/source-image", tmp_path / "src"
            )


def test_login_handles_slow_down_and_uses_profile_key():
    intervals, opens, stored = [], [], []
    packets = iter(
        [
            httpx.Response(
                200,
                json={
                    "device_code": "secret",
                    "user_code": "test",
                    "verification_uri": PROFILE.web,
                    "verification_uri_complete": f"{PROFILE.web}/cli/authorize?user_code=test",
                    "interval": 1,
                    "expires_in": 100,
                },
            ),
            httpx.Response(400, json={"error": "authorization_pending"}),
            httpx.Response(400, json={"error": "slow_down"}),
            httpx.Response(200, json={"access_token": "bearer"}),
        ]
    )

    class Keychain:
        def set_password(self, *args):
            stored.append(args)

    def handle(request):
        if request.url.path.endswith("/token"):
            assert json.loads(request.content) == {"device_code": "secret"}
        return next(packets)

    with httpx.Client(base_url=PROFILE.api, transport=httpx.MockTransport(handle)) as http:
        login(http, PROFILE, Keychain(), browser=opens.append, sleep=intervals.append)
    assert intervals == [1, 1, 6]
    assert opens == [f"{PROFILE.web}/cli/authorize?user_code=test"]
    assert stored[0][1:] == (PROFILE.credential_key, "bearer")
    assert PROFILE.credential_key != Profile("prod", PROFILE.web, PROFILE.api).credential_key


async def test_trellis_image_job_downloads_source_and_uploads_local_attempt(tmp_path):
    source = b"synthetic image"
    bbox = {"min": [0, 0, 0], "max": [1, 1, 1]}
    prefix = f"/api/v1/inference/jobs/{JOB}"
    completions = []

    class Trellis:
        async def run(self, command, attempt, parameters, out):
            assert command == "generate_model"
            assert set(parameters) == {"image_path", "image_sha256"}
            from pathlib import Path

            assert Path(parameters["image_path"]).read_bytes() == source
            assert parameters["image_sha256"] == hashlib.sha256(source).hexdigest()
            directory = out / attempt
            directory.mkdir()
            (directory / "asset.ply").write_bytes(b"fake PLY")
            (directory / "result.json").write_text(json.dumps({"bbox": bbox}))
            return {"status": "succeeded"}

    async def handle(request):
        path = request.url.path
        assert request.headers["Authorization"] == "Bearer worker"
        if path.endswith("/claim"):
            return httpx.Response(
                200,
                json={
                    "command": "generate_model",
                    "attempt_id": ATTEMPT,
                    "input": {"source_image": f"{prefix}/source-image?attempt_id={ATTEMPT}"},
                },
            )
        if path.endswith("/heartbeat"):
            return httpx.Response(200, json={})
        if path.endswith("/source-image"):
            assert tuple(request.url.params.multi_items()) == (("attempt_id", ATTEMPT),)
            return httpx.Response(200, content=source)
        if request.method == "POST" and path.endswith("/uploads"):
            (file,) = json.loads(request.content)["files"]
            assert file["format"] == "ply"
            return httpx.Response(
                200,
                json={
                    "files": [
                        {
                            "file_id": file["file_id"],
                            "upload_id": UPLOAD,
                            "upload_url": f"{prefix}/uploads/{UPLOAD}?attempt_id={ATTEMPT}",
                            "headers": {"Content-Length": "8"},
                        }
                    ]
                },
            )
        if request.method == "PUT":
            assert await request.aread() == b"fake PLY"
            return httpx.Response(200)
        if path.endswith("/complete"):
            completions.append(json.loads(request.content))
            return httpx.Response(200, json={"status": "succeeded"})
        raise AssertionError(path)

    async with httpx.AsyncClient(
        base_url=PROFILE.api, transport=httpx.MockTransport(handle)
    ) as http:
        await InferenceConnection(PROFILE, "worker", http, Trellis(), tmp_path).process(
            {"job_id": JOB, "command": "generate_model"}
        )
    assert completions == [
        {
            "attempt_id": ATTEMPT,
            "assets": [
                {
                    "name": "Trellis",
                    "bbox": bbox,
                    "primary_upload_id": UPLOAD,
                    "upload_ids": [UPLOAD],
                }
            ],
        }
    ]
