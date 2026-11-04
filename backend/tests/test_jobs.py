from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from conftest import create_editor_app
from httpx import ASGITransport, AsyncClient

from camera_path.config import Settings
from camera_path.persistence.records import JobRecord


@pytest.fixture
async def jobs(tmp_path):
    app = create_editor_app(
        Settings(
            _env_file=None,
            database_url=f"sqlite+aiosqlite:///{tmp_path / 'db.sqlite3'}",
            library_directory=tmp_path / "library",
            message_queue="none",
        )
    )
    await app.state.project_repository.initialize()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield app, client
    await app.state.project_repository.close()


async def test_validated_generation_input_is_persisted_without_starting_a_pipeline(jobs):
    app, client = jobs
    data = {"type": "generation", "input": {"prompt": " A wooden chair 🪑\n"}}
    response = await client.post("/api/v1/jobs", json=data)
    assert response.status_code == 201
    job = response.json()
    assert str(UUID(job["id"])) == job["id"]
    assert job["input"] == data["input"] and job["type"] == "generation"
    assert job["status"] == "draft" and job["created_at"] is not None
    assert job["error"] is job["started_at"] is job["completed_at"] is None
    assert job["assets"] == []
    await app.state.project_repository.close()
    assert (await client.get(f"/api/v1/jobs/{job['id']}")).json() == job
    summary = (await client.get("/api/v1/jobs")).json()[0]
    assert summary["prompt"] == data["input"]["prompt"]
    assert summary["status"] == "draft" and summary["asset_count"] == 0
    assert summary["assets"] == [] and "input" not in summary


@pytest.mark.parametrize(
    "data",
    [
        {},
        {"type": "generation"},
        {"input": {"prompt": "Chair"}},
        {"type": "unknown", "input": {"prompt": "Chair"}},
        {"type": "generation", "input": None},
        {"type": "generation", "input": []},
        {"type": "generation", "input": {}},
        *(
            {"type": "generation", "input": {"prompt": v}}
            for v in ["", " \t\n", 123, True, None, []]
        ),
        {"type": "generation", "input": {"prompt": "Chair", "command": "anything"}},
        {"type": "generation", "input": {"prompt": "Chair"}, "status": "succeeded"},
        {"type": "generation", "input": {"prompt": "Chair"}, "id": str(uuid4())},
    ],
)
async def test_invalid_json_is_rejected_without_creating_a_job(jobs, data):
    _, client = jobs
    response = await client.post("/api/v1/jobs", json=data)
    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert response.json()["field_errors"]
    assert (await client.get("/api/v1/jobs")).json() == []


async def test_job_reads_preserve_explicit_status_errors_unknown_types_and_order(jobs):
    app, client = jobs
    now = datetime.now(UTC)
    async with app.state.job_service.sessions.begin() as session:
        session.add_all(
            [
                JobRecord(id="legacy", status="draft"),
                JobRecord(
                    id="failure",
                    type="generation",
                    input={"prompt": "Chair"},
                    status="failed",
                    created_at=now,
                    completed_at=now,
                    error={"code": "generation_failed", "message": "Generation failed."},
                ),
                JobRecord(
                    id="future",
                    type="future_pipeline",
                    input={"other": True},
                    status="running",
                    created_at=now,
                    started_at=now,
                ),
            ]
        )
    rows = (await client.get("/api/v1/jobs")).json()
    assert [row["id"] for row in rows] == ["failure", "future", "legacy"]
    assert rows[0]["status"] == "failed" and rows[0]["error"]["code"] == "generation_failed"
    assert rows[1]["type"] == "future_pipeline" and rows[1]["prompt"] is None
    assert rows[2]["type"] is rows[2]["created_at"] is rows[2]["prompt"] is None
