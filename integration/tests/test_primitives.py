"""Primitive descriptors survive a real server restart without library files."""

import json

import pytest


@pytest.mark.parametrize("kind", ["cube", "sphere", "cone"])
def test_primitive_creation_transform_validation_and_restart(editor, kind):
    backend = editor
    project = backend.project()
    descriptor = {"type": kind, "color": "#336699"}
    obj = project.mutate(
        "POST",
        "/scene-objects",
        201,
        json={"primitive": json.dumps(descriptor), "scale": [2, 3, 4]},
    ).json()
    assert json.loads(obj["primitive"]) == descriptor
    assert obj["name"] == f"{kind.capitalize()} 01"
    assert obj["library_asset_id"] is obj["library_asset_file_id"] is None
    assert obj["format"] is obj["download_url"] is None
    assert backend.request("GET", "/api/v1/library").json() == []
    before = project.get().headers["etag"]
    project.mutate(
        "POST", "/scene-objects", 422, json={"primitive": '{"type":"cube","vertices":[1]}'}
    )
    assert project.get().headers["etag"] == before
    moved = project.mutate(
        "PATCH", f"/scene-objects/{obj['id']}", json={"position": [1, 2, 3]}
    ).json()
    backend.stop()
    backend.start()
    assert project.get("/scene-objects").json() == [moved]
    project.mutate("DELETE", f"/scene-objects/{obj['id']}", 204)
    assert project.get("/scene-objects").json() == []
