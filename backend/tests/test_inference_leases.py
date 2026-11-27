from uuid import uuid4

import pytest
from sqlalchemy import update

from camera_path.api import create_app
from camera_path.config import Settings
from camera_path.persistence.inference_attempt import InferenceAttemptRecord
from camera_path.services.inference import AttemptRequest, FailureRequest
from camera_path.services.jobs import JobCreate
from camera_path.services.library_metadata import LibraryError


@pytest.fixture
async def cli_jobs(tmp_path):
    app = create_app(
        Settings(
            _env_file=None,
            database_url=f"sqlite+aiosqlite:///{tmp_path / 'db.sqlite3'}",
            library_directory=tmp_path / "assets",
        )
    )
    await app.state.project_repository.initialize()
    try:
        yield app.state.inference
    finally:
        await app.state.project_repository.close()


async def test_expired_attempt_fenced_and_job_stops_after_three_claims(cli_jobs):
    service = cli_jobs
    workers = [str(uuid4()), str(uuid4())]
    for worker in workers:
        service.register(worker, ["generate_model"])
        assert service.attach(worker, object())
    job = await service.jobs.create(
        JobCreate(
            type="generation",
            input={"prompt": "A small chair"},
            start=True,
        )
    )
    consecutive = await service.jobs.create(
        JobCreate(
            type="generation",
            input={"prompt": "Second job"},
            start=True,
        )
    )
    for ordinal in range(3):
        winner, loser = workers[ordinal % 2], workers[1 - ordinal % 2]
        assert await service.next_for(winner) == (job.id, "generate_model")
        claim_id = str(uuid4())
        attempt = await service.claim(winner, job.id, claim_id)
        assert await service.claim(winner, job.id, claim_id) == attempt
        with pytest.raises(LibraryError) as conflict:
            await service.claim(loser, job.id, str(uuid4()))
        assert conflict.value.status == 409
        with pytest.raises(LibraryError) as busy:
            await service.claim(winner, consecutive.id, str(uuid4()))
        assert busy.value.status == 409
        attempt_id = str(attempt.attempt_id)
        async with service.sessions.begin() as session:
            await session.execute(
                update(InferenceAttemptRecord)
                .where(InferenceAttemptRecord.id == attempt_id)
                .values(lease_expires_at=0)
            )
        await service.expire()
        with pytest.raises(LibraryError) as stale:
            await service.renew(winner, job.id, attempt_id)
        assert stale.value.status == 409
        with pytest.raises(LibraryError) as late_result:
            await service.fail(
                winner,
                job.id,
                FailureRequest(
                    **AttemptRequest(attempt_id=attempt.attempt_id).model_dump(),
                    error={"code": "too_late", "message": "This worker lost the lease"},
                ),
            )
        assert late_result.value.status == 409
    failed = await service.jobs.get(job.id)
    assert failed.status == "failed" and failed.error.code == "inference_attempts_exhausted"
    assert await service.next_for(workers[0]) == (consecutive.id, "generate_model")
