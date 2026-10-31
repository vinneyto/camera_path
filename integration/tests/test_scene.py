import math

import pytest


def test_anchor_point_crud_references_and_cascades(editor):
    p = editor.project()
    a = p.anchor(position=[1, 2, 3])
    changed = p.mutate("PATCH", f"/anchors/{a['id']}", json={"lift": 4, "label": "Lifted"})
    assert changed.json()["lift"] == 4
    assert changed.json()["surface_position"] == [1, 2, 3]
    assert p.get("/anchors").json() == [changed.json()]
    before = p.get().headers["etag"]
    p.mutate("PATCH", f"/anchors/{a['id']}", 422, json={"surface_normal": [0, 0, 0]})
    assert p.get().headers["etag"] == before
    point = p.mutate(
        "POST", "/scene-points", 201, json={"label": "Subject", "position": [4, 5, 6]}
    ).json()
    point = p.mutate(
        "PATCH", f"/scene-points/{point['id']}", json={"label": "Moved", "position": [7, 8, 9]}
    ).json()
    assert p.get("/scene-points").json() == [point]
    key = p.mutate(
        "POST",
        "/camera/keyframes",
        201,
        json={"path_position": 0, "aim": {"kind": "look_at_point", "scene_point_id": point["id"]}},
    ).json()
    p.mutate("DELETE", f"/scene-points/{point['id']}", 409)
    p.mutate("DELETE", f"/scene-points/{point['id']}?cascade=true", 204)
    assert p.get("/scene-points").json() == []
    assert key["id"] not in p.get("/camera").json()["keyframes"]
    p.mutate("DELETE", f"/anchors/{a['id']}", 204)
    assert p.get("/anchors").json() == []
    p.mutate("DELETE", "/anchors/missing", 404)
    p.mutate("PATCH", "/scene-points/missing", 404, json={"label": "missing"})


def test_straight_spline_compilation_and_resource_preservation(editor):
    p = editor.project()
    anchors = [p.anchor(str(i), position=[i * 2, 0, 0])["id"] for i in range(3)]
    segment = p.mutate(
        "POST", "/segments/spline", 201, json={"anchor_ids": anchors, "tension": 0}
    ).json()
    assert segment["kind"] == "spline"
    trajectory = p.get("/trajectory").json()
    assert trajectory["segments"] == [segment]
    compiled = p.get("/trajectory/compiled").json()
    assert compiled["total_length"] == pytest.approx(4, abs=1e-3)
    assert compiled["duration_seconds"] > 0
    assert len(compiled["position_segments"]) >= 2
    assert all(
        math.isfinite(x)
        for seg in compiled["position_segments"]
        for v in seg.values()
        if isinstance(v, list)
        for x in v
        if isinstance(x, (int, float))
    )
    # Reusing an anchor in a segment must protect it from an unqualified deletion.
    p.mutate("DELETE", f"/anchors/{anchors[0]}", 409)
    p.mutate("DELETE", f"/segments/{segment['id']}", 204)
    assert p.get("/trajectory").json()["segments"] == []
    assert len(p.get("/anchors").json()) == 3
    p.mutate("DELETE", "/trajectory", 204)
    assert len(p.get("/anchors").json()) == 3


def test_cp117_spiral_delete_point_recreate_uses_current_revision(editor):
    p = editor.project()
    start = p.anchor("Start", [1, 0, 0])["id"]
    center = p.anchor("Center", [0, 0, 0])["id"]
    end = p.anchor("End", [2, 2, 0])["id"]

    def spiral():
        return p.mutate(
            "POST",
            "/segments/spiral",
            201,
            json={
                "start_anchor_id": start,
                "center_anchor_id": center,
                "end_anchor_id": end,
                "turns": 1,
                "direction": "ccw",
            },
        ).json()

    first = spiral()
    assert p.get("/trajectory/compiled").json()["total_length"] > 0
    p.mutate("DELETE", f"/segments/{first['id']}", 204)
    p.mutate("DELETE", f"/anchors/{end}", 204)
    end = p.anchor("End again", [2, 2, 0])["id"]
    second = spiral()
    assert second["id"] != first["id"]
    assert p.get("/trajectory").json()["segments"] == [second]


KEYFRAMES = [
    ("/motion", {"path_position": 0.2, "speed": 2}, {"speed": 3}, "speed", 3),
    (
        "/camera",
        {"path_position": 0.2, "aim": {"kind": "follow_path"}},
        {"aim": {"kind": "follow_path", "direction": "backward"}},
        "aim",
        {"kind": "follow_path", "direction": "backward"},
    ),
    (
        "/camera/orientation",
        {"path_position": 0.2, "orientation": {"yaw_deg": 45}},
        {"orientation": {"yaw_deg": 90}},
        "orientation",
        {"yaw_deg": 90, "pitch_deg": 0, "roll_deg": 0},
    ),
    ("/camera/depth-of-field", {"path_position": 0.2}, {"bokeh_scale": 12}, "bokeh_scale", 12),
]


@pytest.mark.parametrize(
    "timeline,payload,patch,field,value", KEYFRAMES, ids=[v[0] for v in KEYFRAMES]
)
def test_keyframe_crud_persistence_and_timeline_removal(
    editor, timeline, payload, patch, field, value
):
    p = editor.project()
    a = p.anchor()
    key = p.mutate("POST", timeline + "/keyframes", 201, json=payload).json()
    key_path = f"{timeline}/keyframes/{key['id']}"
    changed = p.mutate(
        "PATCH", key_path, json={**patch, "path_position": 0.7, "interpolation_to_next": "hold"}
    ).json()
    assert changed[field] == value and changed["path_position"] == 0.7
    if timeline != "/camera/depth-of-field":
        assert changed["interpolation_to_next"] == "hold"
    assert p.get(timeline).json()["keyframes"][key["id"]] == changed
    editor.stop()
    editor.start()
    assert p.get(timeline).json()["keyframes"][key["id"]] == changed
    p.mutate("PATCH", key_path, 422, json={"path_position": 1.1})
    assert p.get(timeline).json()["keyframes"][key["id"]] == changed
    p.mutate("DELETE", key_path, 204)
    assert p.get(timeline).json()["keyframes"] == {}
    p.mutate("POST", timeline + "/keyframes", 201, json=payload)
    p.mutate("DELETE", timeline, 204)
    assert p.get(timeline).json()["keyframes"] == {}
    assert p.get("/anchors").json() == [a]


def test_defaults_dof_idempotency_and_lidar(editor):
    p = editor.project()
    assert p.mutate("PATCH", "/motion", json={"default_speed": 2}).json()["default_speed"] == 2
    p.mutate(
        "PATCH", "/camera", json={"default_aim": {"kind": "follow_path", "direction": "backward"}}
    )
    assert p.get("/camera").json()["default_aim"]["direction"] == "backward"
    p.mutate("PATCH", "/camera/orientation", json={"yaw_deg": 30, "roll_deg": 15})
    assert p.get("/camera/orientation").json()["default_orientation"]["yaw_deg"] == 30
    dof = p.mutate("POST", "/camera/depth-of-field").json()
    assert len(dof["keyframes"]) == 1
    assert p.mutate("POST", "/camera/depth-of-field").json() == dof
    assert p.get("/camera/lidar").json() == {"lidar_keyframe": None}
    first = p.mutate("PATCH", "/camera/lidar", json={}).json()["lidar_keyframe"]
    assert first["path_position"] == 0 and first["horizontal_resolution"] == 512
    second = p.mutate("PATCH", "/camera/lidar", json={"vertical_fov_deg": 90}).json()[
        "lidar_keyframe"
    ]
    assert second["id"] == first["id"] and second["vertical_fov_deg"] == 90
    p.mutate("DELETE", "/camera/lidar", 204)
    assert p.get("/camera/lidar").json()["lidar_keyframe"] is None


@pytest.mark.parametrize(
    "suffix,payload",
    [
        ("/anchors", {"label": "", "surface_position": [0, 0, 0]}),
        ("/anchors", {"label": "A", "surface_position": [0, 0]}),
        ("/scene-points", {"label": "", "position": [0, 0, 0]}),
        ("/segments/spline", {"anchor_ids": ["only-one"]}),
        ("/segments/spiral", {"turns": 0}),
        ("/motion/keyframes", {"path_position": 0, "speed": 0}),
        ("/camera/keyframes", {"path_position": -1, "aim": {"kind": "follow_path"}}),
        ("/camera/orientation/keyframes", {"path_position": 0, "orientation": {"yaw_deg": "NaN"}}),
        ("/camera/depth-of-field/keyframes", {"path_position": 0, "bokeh_scale": -1}),
    ],
)
def test_invalid_resource_creation_is_atomic(editor, suffix, payload):
    p = editor.project()
    before = p.get().json()
    p.mutate("POST", suffix, 422, json=payload)
    assert p.get().json() == before


@pytest.mark.parametrize(
    "payload",
    [
        {"vertical_fov_deg": 180},
        {"horizontal_resolution": 0},
        {"vertical_resolution": 1.5},
        {"path_position": 0.5},
    ],
)
def test_invalid_lidar_is_atomic(editor, payload):
    p = editor.project()
    before = p.get().json()
    p.mutate("PATCH", "/camera/lidar", 422, json=payload)
    assert p.get().json() == before
