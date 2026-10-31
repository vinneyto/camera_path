from concurrent.futures import ThreadPoolExecutor

import pytest


def test_metadata_public_reads_revision_guards_and_reset(editor):
    b = editor
    p = b.project("Original")
    assert p.get().headers["etag"] == '"0"'
    meta = p.get().json()
    assert meta["name"] == "Original" and meta["anchor_count"] == meta["segment_count"] == 0
    assert "anchors" not in meta
    for suffix in [
        "",
        "/anchors",
        "/scene-points",
        "/trajectory",
        "/trajectory/compiled",
        "/motion",
        "/camera",
        "/camera/orientation",
        "/camera/depth-of-field",
        "/camera/lidar",
        "/clouds",
        "/chat/messages",
    ]:
        assert b.request("GET", p.path + suffix, auth=False).headers["etag"] == '"0"'
    for header, expected, code in [
        (None, 428, "if_match_required"),
        ("invalid", 409, "revision_conflict"),
        ('"999"', 409, "revision_conflict"),
    ]:
        response = b.request(
            "PATCH",
            p.path,
            expected,
            json={"name": "lost"},
            headers={} if header is None else {"If-Match": header},
        )
        assert response.json()["code"] == code
    assert p.get().json() == meta
    updated = p.mutate("PATCH", json={"name": "Renamed"})
    assert updated.headers["etag"] == '"1"'
    assert p.get().json()["name"] == "Renamed"
    assert p.id in [x["id"] for x in b.request("GET", "/api/v1/projects", auth=False).json()]
    p.anchor()
    other = b.project("Untouched")
    other.anchor()
    p.mutate("POST", "/reset")
    assert p.get("/anchors").json() == []
    assert len(other.get("/anchors").json()) == 1
    p.mutate("DELETE", expected=204)
    b.request("GET", p.path, 404, auth=False)
    assert len(other.get("/anchors").json()) == 1


def test_two_simultaneous_writes_cannot_lose_an_update(editor):
    b = editor
    p = b.project()
    with ThreadPoolExecutor(max_workers=2) as pool:
        replies = list(
            pool.map(
                lambda name: b.client.patch(
                    p.path,
                    json={"name": name},
                    headers={"Authorization": f"Bearer {b.token}", "If-Match": '"0"'},
                ),
                ["one", "two"],
            )
        )
    assert sorted(r.status_code for r in replies) == [200, 409]
    winner = next(r.json()["name"] for r in replies if r.status_code == 200)
    assert p.get().json()["name"] == winner
    assert p.get().headers["etag"] == '"1"'


@pytest.mark.parametrize("name", ["", "x" * 129])
def test_project_name_validation_has_no_side_effects(editor, name):
    b = editor
    r = b.request("POST", "/api/v1/projects", 422, json={"name": name})
    assert r.json()["code"] == "validation_error" and r.json()["field_errors"]
    assert b.request("GET", "/api/v1/projects").json() == []


def test_user_settings_persist_with_public_reads_and_editor_only_writes(editor):
    b = editor
    url = "/api/v1/profile/settings"
    original = b.request("GET", url).json()
    desired = {"show_grid": False, "gaussian_dpr": "system", "webgpu_tile_renderer": True}
    assert b.request("PATCH", url, json=desired).json() == desired
    assert b.request("GET", url, auth=False).json() == desired
    b.request("PATCH", url, 401, auth=False, json={"show_grid": True})
    b.stop()
    b.start()
    assert b.request("GET", url).json() == desired
    b.request("PATCH", url, 422, json={"unknown": True})
    b.request("PATCH", url, json=original)


def test_restart_preserves_project_and_error_atomicity(editor):
    b = editor
    p = b.project()
    a = p.anchor()
    before = p.get().json()
    p.mutate("POST", "/segments/spline", 422, json={"anchor_ids": [a["id"], "missing"]})
    assert p.get().json() == before
    b.stop()
    b.start()
    assert p.get().json() == before
    assert p.get("/anchors").json() == [a]
