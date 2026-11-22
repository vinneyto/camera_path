"""Real Uvicorn WebSocket/REST integration; model outputs are compact fixtures."""

import hashlib
import json
import time
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from conftest import Backend
from test_painter import PNG
from websockets.sync.client import connect

PREFIX = "/api/v1"
WORKERS = PREFIX + "/inference"
DEVICE = PREFIX + "/auth/cli"
PLY = b"ply\nformat ascii 1.0\nelement vertex 0\nend_header\n"


def pair(backend):
    device = backend.request("POST", DEVICE + "/device", auth=False).json()
    assert device["device_code"] not in device["verification_uri_complete"]
    backend.request(
        "POST",
        DEVICE + "/decision",
        204,
        json={"user_code": device["user_code"], "approve": True},
    )
    token = backend.request(
        "POST",
        DEVICE + "/token",
        json={"device_code": device["device_code"]},
        auth=False,
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def job(backend, kind, value):
    return backend.request(
        "POST", PREFIX + "/jobs", 201, json={"type": kind, "input": value, "start": True}
    ).json()


def worker_request(backend, bearer, method, path, status=200, **kwargs):
    return backend.request(method, path, status, auth=False, headers=bearer, **kwargs)


def attempt_path(job_id):
    return WORKERS + "/jobs/" + job_id


def register(backend, bearer):
    worker_request(
        backend,
        bearer,
        "PUT",
        WORKERS + "/worker",
        204,
        json={"schema_version": 1, "capabilities": ["generate_image", "generate_model"]},
    )


def turn(backend, socket, bearer, item):
    event = json.loads(socket.recv(timeout=8))
    assert event == {
        "schema_version": 1,
        "type": "command.available",
        "job_id": item["id"],
        "command": item["inference_command"],
    }
    claim = {"claim_id": str(uuid4())}
    base = attempt_path(item["id"])
    value = worker_request(backend, bearer, "POST", base + "/claim", json=claim).json()
    assert value == worker_request(backend, bearer, "POST", base + "/claim", json=claim).json()
    worker_request(
        backend,
        bearer,
        "POST",
        base + "/heartbeat",
        json={"attempt_id": value["attempt_id"]},
    )
    return value


def stage(backend, bearer, item, claim, fmt, data):
    base = attempt_path(item["id"])
    payload = {
        "attempt_id": claim["attempt_id"],
        "files": [
            {
                "file_id": "main",
                "format": fmt,
                "size_bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            }
        ],
    }
    one = worker_request(backend, bearer, "POST", base + "/uploads", json=payload).json()
    two = worker_request(backend, bearer, "POST", base + "/uploads", json=payload).json()
    assert one["files"][0]["upload_id"] == two["files"][0]["upload_id"]
    dst = two["files"][0]
    worker_request(
        backend,
        {**bearer, **dst["headers"]},
        "PUT",
        dst["upload_url"],
        422,
        content=data[:-1] + bytes([data[-1] ^ 1]),
    )
    worker_request(
        backend, {**bearer, **dst["headers"]}, "PUT", dst["upload_url"], 204, content=data
    )
    return dst["upload_id"]


def test_cli_inference_survives_restart_and_publishes_each_job_once(tmp_path):
    backend = Backend(tmp_path)
    # Painter is the default even when the chat service has an OpenAI key.
    backend.env.pop("CAMERA_PATH_IMAGE_GENERATION_PROVIDER")
    backend.env["CAMERA_PATH_CLI_WEB_URL"] = "http://localhost:3030"
    try:
        backend.setup()
        backend.login()
        painter = job(backend, "image_generation", {"prompt": "Fixture chair"})
        assert painter["status"] == "queued"
        assert painter["inference_command"] == "generate_image"
        assert backend.request("GET", WORKERS + "/status").json() == {
            "connected": False,
            "capabilities": [],
            "available_capabilities": [],
        }
        bearer, other = pair(backend), pair(backend)
        backend.stop()
        backend.start()
        assert (
            backend.request("GET", PREFIX + "/jobs/" + painter["id"]).json()["status"] == "queued"
        )
        worker_request(backend, bearer, "GET", PREFIX + "/auth/session", 401)
        register(backend, bearer)
        register(backend, other)
        url = backend.url.replace("http:", "ws:", 1) + WORKERS + "/commands"
        with connect(url, additional_headers=bearer, open_timeout=5) as socket:
            claim = turn(backend, socket, bearer, painter)
            status = backend.request("GET", WORKERS + "/status").json()
            assert status["connected"] and not status["available_capabilities"]
            put_id = stage(backend, bearer, painter, claim, "png", PNG)
            base = attempt_path(painter["id"])
            manifest = {"attempt_id": claim["attempt_id"], "image_upload_id": put_id}
            worker_request(backend, other, "POST", base + "/complete", 404, json=manifest)
            with ThreadPoolExecutor(2) as pool:
                receipts = list(
                    pool.map(
                        lambda _: worker_request(
                            backend, bearer, "POST", base + "/complete", json=manifest
                        ).json(),
                        range(2),
                    )
                )
            assert receipts[0] == receipts[1] and len(receipts[0]["asset_ids"]) == 1
            image = receipts[0]["asset_ids"][0]
            assert (
                backend.request("GET", PREFIX + "/jobs/" + painter["id"] + "/image").content == PNG
            )

            trellis = job(backend, "generation", {"image_asset_id": image})
            claim = turn(backend, socket, bearer, trellis)
            source = claim["input"]["source_image"]
            worker_request(backend, other, "GET", source, 404)
            assert worker_request(backend, bearer, "GET", source).content == PNG
            upload = stage(backend, bearer, trellis, claim, "ply", PLY)
            base = attempt_path(trellis["id"])
            result = worker_request(
                backend,
                bearer,
                "POST",
                base + "/complete",
                json={
                    "attempt_id": claim["attempt_id"],
                    "assets": [
                        {
                            "name": "Fixture asset.ply",
                            "primary_upload_id": upload,
                            "upload_ids": [upload],
                        }
                    ],
                },
            ).json()
            assert result["status"] == "succeeded" and len(result["asset_ids"]) == 1
            assert (
                len(backend.request("GET", PREFIX + "/jobs/" + trellis["id"]).json()["assets"]) == 1
            )

            failed = job(backend, "generation", {"prompt": "Failure fixture"})
            claim = turn(backend, socket, bearer, failed)
            base = attempt_path(failed["id"])
            error = {"code": "fixture_failed", "message": "Intentional fixture failure"}
            payload = {"attempt_id": claim["attempt_id"], "error": error}
            assert (
                worker_request(backend, bearer, "POST", base + "/fail", json=payload).json()[
                    "status"
                ]
                == "failed"
            )
            worker_request(backend, bearer, "POST", base + "/fail", json=payload)
            worker_request(
                backend,
                bearer,
                "POST",
                base + "/fail",
                409,
                json={**payload, "error": {**error, "message": "Conflicting receipt"}},
            )
        worker_request(backend, bearer, "POST", DEVICE + "/logout", 204)
        worker_request(
            backend,
            bearer,
            "PUT",
            WORKERS + "/worker",
            401,
            json={
                "schema_version": 1,
                "capabilities": [],
            },
        )
        for _ in range(30):
            if not backend.request("GET", WORKERS + "/status").json()["connected"]:
                break
            time.sleep(0.05)
        else:
            raise AssertionError("Closed worker was not marked offline")
        backend.stop()
        backend.start()
        assert (
            worker_request(
                backend,
                other,
                "POST",
                attempt_path(painter["id"]) + "/complete",
                404,
                json=manifest,
            ).status_code
            == 404
        )
    finally:
        backend.close()
