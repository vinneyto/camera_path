"""The real API and RabbitMQ round-trip, with worker messages and fixture files."""

import json
import sqlite3

from test_job_completion import PLY, SOG, wait_job

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
