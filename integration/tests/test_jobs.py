"""Job discovery works independently of generation and the configured queue."""


def test_public_catalogue_reservation_and_restart(editor):
    b = editor
    assert b.request("GET", "/api/v1/jobs", auth=False).json() == []
    jobs = [b.request("POST", "/api/v1/jobs", 201).json() for _ in range(3)]
    expected = sorted(
        [{"id": job["id"], "completed_at": None, "asset_count": 0} for job in jobs],
        key=lambda job: job["id"],
    )
    assert b.request("GET", "/api/v1/jobs", auth=False).json() == expected
    for job in jobs:
        assert b.request("GET", f"/api/v1/jobs/{job['id']}", auth=False).json() == job
    b.stop()
    b.start()
    assert b.request("GET", "/api/v1/jobs", auth=False).json() == expected
