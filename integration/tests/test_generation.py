"""The real API and RabbitMQ round-trip, with worker messages and fixture files."""

import json
import sqlite3

from test_job_completion import PLY, SOG, descriptor, enqueue, wait_job

BOUNDS = {"min": [-1, -2, -3], "max": [1, 2, 3]}


def configure(b, broker_url):
    b.env.update(
        {
            "CAMERA_PATH_RABBITMQ_URL": broker_url,
            "CAMERA_PATH_GENERATION_OUTPUT_DIRECTORY": str(b.directory / "generation"),
            "CAMERA_PATH_GENERATION_REQUEST_QUEUE": b.queue_name + "-generate",
            "CAMERA_PATH_GENERATION_RESULT_QUEUE": b.queue_name + "-results",
        }
    )


def create_generation(b, prompt):
    job = b.request(
        "POST",
        "/api/v1/jobs",
        201,
        json={"type": "generation", "input": {"prompt": prompt}, "start": True},
    ).json()
    assert job["status"] == "queued" and job["assets"] == []
    return job


def take_request(b, job):
    queue = b.env["CAMERA_PATH_GENERATION_REQUEST_QUEUE"]
    b.broker.wait_queue(queue)
    command = b.broker.get_message(queue)
    assert command["properties"]["correlation_id"] == job["id"]
    assert json.loads(command["body"]) == {
        "schema_version": 1,
        "job_id": job["id"],
        "input": job["input"],
    }


def completion(b, job, *, invalid_path=False):
    job_id = job["id"]
    directory = b.directory / "generation" / job_id
    directory.mkdir(parents=True)
    (directory / "asset.ply").write_bytes(PLY)
    (directory / "asset.sog").write_bytes(SOG)
    (directory / "result.json").write_text(
        json.dumps(
            {
                "schema_version": 1,
                "job_id": job_id,
                "input": job["input"],
                "bbox": BOUNDS,
                "files": [
                    "../asset.ply" if invalid_path else f"{job_id}/asset.ply",
                    f"{job_id}/asset.sog",
                ],
            }
        )
    )
    return {
        "schema_version": 1,
        "job_id": job_id,
        "status": "succeeded",
        "result_path": f"{job_id}/result.json",
    }


def status_event(lines):
    assert next(lines) == "event: job-status"
    status = json.loads(next(lines).removeprefix("data: "))["status"]
    assert next(lines) == ""
    return status


def test_generation_round_trip_after_backend_restart(dev_backend):
    b = dev_backend
    legacy = b.create_job("Previously queued")
    b.stop()
    with sqlite3.connect(b.directory / "db.sqlite3") as db:
        db.execute("UPDATE jobs SET status = 'queued' WHERE id = ?", (legacy["id"],))
    configure(b, "amqp://guest:guest@127.0.0.1:1/")
    b.start()
    job = create_generation(b, "A red chair")
    job_path = f"/api/v1/jobs/{job['id']}"
    b.stop()
    configure(b, b.broker.url)
    b.start()

    take_request(b, job)
    queue = b.env["CAMERA_PATH_GENERATION_RESULT_QUEUE"]
    result = completion(b, job)
    with b.client.stream("GET", f"{job_path}/events") as stream:
        assert stream.status_code == 200
        assert stream.headers["content-type"].startswith("text/event-stream")
        lines = stream.iter_lines()
        assert status_event(lines) == "queued"
        b.broker.publish(queue, result)
        assert status_event(lines) == "succeeded"
        assert list(lines) == []

    # A replay of the same terminal message must not duplicate the imported files.
    b.broker.publish(queue, result)
    barrier = b"generation-settlement-barrier"
    b.broker.publish(queue, barrier)
    assert b.broker.get_failure(queue)["body"] == barrier

    finished = b.request("GET", job_path, auth=False).json()
    assert finished["status"] == "succeeded" and finished["completed_at"]
    asset = finished["assets"][0]
    assert len(finished["assets"]) == 1 and len(asset["files"]) == 2
    assert asset["job_id"] == job["id"] and asset["bbox"] == BOUNDS
    assert asset["default_rotation_deg"] == [0, 0, 0]
    assert b.request("GET", asset["download_url"]).content == PLY
    assert b.request("GET", asset["files"][1]["download_url"]).content == SOG
    assert b.request("GET", f"/api/v1/library/{asset['id']}").json()["bbox"] == BOUNDS

    failed = create_generation(b, "A broken model")
    take_request(b, failed)
    error = {"code": "generation_failed", "message": "Trellis generation failed."}
    b.broker.publish(
        queue,
        {"schema_version": 1, "job_id": failed["id"], "status": "failed", "error": error},
    )
    failed = wait_job(b, failed["id"])
    assert failed["status"] == "failed" and failed["error"] == error and failed["assets"] == []

    malformed = create_generation(b, "Invalid result manifest")
    take_request(b, malformed)
    invalid = completion(b, malformed, invalid_path=True)
    b.broker.publish(queue, invalid)
    assert json.loads(b.broker.get_failure(queue)["body"]) == invalid
    malformed = wait_job(b, malformed["id"])
    assert malformed["status"] == "failed" and malformed["assets"] == []
    assert malformed["error"]["code"] == "invalid_generation_result"

    # Legacy completion messages still use their own queue and importer.
    draft = b.create_job()
    assert draft["status"] == "draft"


def test_trellis_rotation_is_opt_in_and_applies_only_to_generated_assets(dev_backend):
    b = dev_backend
    b.stop()
    configure(b, b.broker.url)
    b.env["CAMERA_PATH_GENERATION_DEFAULT_ROTATION_DEG"] = "[180,0,0]"
    b.start()

    job = create_generation(b, "An upright chair")
    take_request(b, job)
    b.broker.publish(b.env["CAMERA_PATH_GENERATION_RESULT_QUEUE"], completion(b, job))
    asset = wait_job(b, job["id"])["assets"][0]
    assert asset["default_rotation_deg"] == [180, 0, 0]
    assert asset["bbox"] == BOUNDS
    assert b.request("GET", asset["download_url"]).content == PLY

    external = enqueue(b, descriptor(b))["assets"][0]
    assert external["default_rotation_deg"] == [0, 0, 0]


def test_image_generation_original_lock_and_result_round_trip(dev_backend):
    import base64
    import hashlib
    from pathlib import Path

    b = dev_backend
    b.stop()
    configure(b, b.broker.url)
    b.env["CAMERA_PATH_GENERATION_DEFAULT_ROTATION_DEG"] = "[180,0,0]"
    b.start()
    original = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAAEUlEQVR4nGP8zwAFTDAGEgsAHVsBBeg3qMUAAAAASUVORK5CYII="
    )
    image = b.request(
        "POST",
        "/api/v1/library/uploads",
        201,
        json={
            "name": "Original image",
            "format": "png",
            "size_bytes": len(original),
        },
    ).json()
    b.request("PUT", image["upload_url"], 204, content=original)
    image = b.request("POST", f"/api/v1/library/{image['id']}/complete").json()
    job = b.request(
        "POST",
        "/api/v1/jobs",
        201,
        json={
            "type": "generation",
            "input": {"image_asset_id": image["id"]},
            "start": True,
        },
    ).json()
    b.request("DELETE", f"/api/v1/library/{image['id']}", 409)
    queue = b.env["CAMERA_PATH_GENERATION_REQUEST_QUEUE"]
    b.broker.wait_queue(queue)
    command = json.loads(b.broker.get_message(queue)["body"])
    assert job["name"] == image["name"]
    assert command["job_id"] == job["id"]
    assert Path(command["input"]["image_path"]).read_bytes() == original
    assert command["input"]["image_sha256"] == hashlib.sha256(original).hexdigest()
    result = completion(b, {**job, "input": command["input"]})
    b.broker.publish(b.env["CAMERA_PATH_GENERATION_RESULT_QUEUE"], result)
    finished = wait_job(b, job["id"])
    assert finished["status"] == "succeeded"
    assert finished["input"] == {"image_asset_id": image["id"]}
    assert finished["input_asset"]["id"] == image["id"]
    assert len(finished["assets"]) == 1
    assert finished["assets"][0]["default_rotation_deg"] == [180, 0, 0]
    assert b.request("GET", image["download_url"]).content == original
    b.request("DELETE", f"/api/v1/library/{image['id']}", 204)
    history = b.request("GET", f"/api/v1/jobs/{job['id']}").json()
    assert history["input_asset"] is None and history["input"] == job["input"]
    assert history["name"] == image["name"]
    assert len(history["assets"]) == 1
