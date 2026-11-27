"""Job inputs are validated over HTTP; persisted drafts do not start a pipeline."""

import pytest


def test_public_catalogue_reservation_and_restart(editor):
    b = editor
    assert b.request("GET", "/api/v1/jobs", auth=False).json() == []
    jobs = [b.create_job(prompt=f"Chair {n}") for n in range(3)]
    before = b.request("GET", "/api/v1/jobs", auth=False).json()
    assert [job["id"] for job in before] == [job["id"] for job in reversed(jobs)]
    assert [job["prompt"] for job in before] == ["Chair 2", "Chair 1", "Chair 0"]
    assert [job["name"] for job in before] == ["Chair_2", "Chair_1", "Chair_0"]
    for job in jobs:
        assert job["status"] == "draft" and job["completed_at"] is None
        assert job["created_at"] and job["error"] is None and job["assets"] == []
        assert b.request("GET", f"/api/v1/jobs/{job['id']}", auth=False).json() == job
    b.stop()
    b.start()
    assert b.request("GET", "/api/v1/jobs", auth=False).json() == before
    for job in jobs:
        assert b.request("GET", f"/api/v1/jobs/{job['id']}", auth=False).json() == job


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"type": "other", "input": {"prompt": "Chair"}},
        {"type": "generation", "input": {}},
        {"type": "generation", "input": {"prompt": " \n\t"}},
        {"type": "generation", "input": {"prompt": 123}},
        {"type": "generation", "input": {"prompt": "Chair", "extra": {"x": True}}},
        {"type": "generation", "input": {"prompt": "Chair"}, "status": "succeeded"},
    ],
)
def test_invalid_job_input_does_not_create_partial_job(editor, body):
    b = editor
    b.request("POST", "/api/v1/jobs", 422, json=body)
    assert b.request("GET", "/api/v1/jobs", auth=False).json() == []


def test_generation_queues_without_a_connected_worker_and_survives_restart(editor):
    job = editor.request(
        "POST",
        "/api/v1/jobs",
        201,
        json={"type": "generation", "input": {"prompt": "Chair"}, "start": True},
    ).json()
    assert job["status"] == "queued"
    assert job["inference_command"] == "generate_model"
    assert job["started_at"] is None and job["assets"] == []
    assert editor.request("GET", "/api/v1/inference/status").json()["connected"] is False

    editor.stop()
    editor.start()
    assert editor.request("GET", f"/api/v1/jobs/{job['id']}", auth=False).json() == job


def test_image_generation_type_and_empty_media_endpoints(editor):
    job = editor.request(
        "POST",
        "/api/v1/jobs",
        201,
        json={"type": "image_generation", "input": {"prompt": "A wooden chair"}},
    ).json()
    assert job["type"] == "image_generation" and job["status"] == "draft"
    for suffix in ("image", "source-image"):
        editor.request("GET", f"/api/v1/jobs/{job['id']}/{suffix}", 404, auth=False)
    editor.request(
        "POST",
        "/api/v1/jobs",
        503,
        json={"type": "image_generation", "input": {"prompt": "Chair"}, "start": True},
    )
