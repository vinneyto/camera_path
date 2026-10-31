"""Generate deterministic reference results with the unchanged Python compiler."""

import json
from pathlib import Path

from camera_path.models import (
    Anchor,
    LookAtPointAim,
    Project,
    ScenePoint,
    SpeedKeyframe,
    SpiralSegment,
    SplineSegment,
)
from camera_path.trajectory import compile_project

cases = []


def project(name, points):
    p = Project(id=name, name=name)
    for i, point in enumerate(points):
        key = f"a{i}"
        p.anchors[key] = Anchor(id=key, label=key, surface_position=point)
    return p


def add(p):
    cases.append(
        {
            "name": p.name,
            "project": p.model_dump(mode="json"),
            "compiled": compile_project(p).model_dump(mode="json"),
        }
    )


p = project("straight", [(0, 0, 0), (2, 0, 0), (4, 0, 0)])
p.segments = [SplineSegment(id="s", anchor_ids=list(p.anchors))]
add(p)
p = project("uneven-spatial", [(0, 0, 0), (0.1, 0.2, 0.3), (3, 2, -1), (8, -1, 4)])
p.segments = [SplineSegment(id="s", anchor_ids=list(p.anchors))]
add(p)
p = project("connected-run", [(0, 0, 0), (1, 2, 0), (2, 3, 2), (5, 0, -1)])
p.segments = [
    SplineSegment(id="s1", anchor_ids=["a0", "a1"]),
    SplineSegment(id="s2", anchor_ids=["a1", "a2", "a3"], tension=0.4),
]
add(p)
for direction in ["cw", "ccw"]:
    for law in ["linear", "smoothstep"]:
        p = project(f"spiral-{direction}-{law}", [(1, 0, 0), (0, 0, 0), (0, 3, 2)])
        p.segments = [
            SpiralSegment(
                id="spiral",
                start_anchor_id="a0",
                center_anchor_id="a1",
                end_anchor_id="a2",
                turns=1.25,
                direction=direction,
                radial_law=law,
                axial_law=law,
            )
        ]
        add(p)
p = project("spiral-axis-end", [(2, 0, 0), (0, 0, 0), (0, 4, 0)])
p.segments = [
    SpiralSegment(
        id="sp",
        start_anchor_id="a0",
        center_anchor_id="a1",
        end_anchor_id="a2",
        turns=0.75,
    )
]
add(p)
p = project(
    "spline-spiral-spline", [(-2, 0, -1), (1, 0, 0), (0, 0, 0), (2, 3, 0), (4, 5, 1)]
)
p.segments = [
    SplineSegment(id="before", anchor_ids=["a0", "a1"]),
    SpiralSegment(
        id="sp",
        start_anchor_id="a1",
        center_anchor_id="a2",
        end_anchor_id="a3",
        turns=1,
    ),
    SplineSegment(id="after", anchor_ids=["a3", "a4"]),
]
add(p)
p = project("surface-normal-speed-aim", [(0, 0, 0), (1, 2, 3), (5, 3, -2)])
p.anchors["a1"].surface_normal = (1, 2, 3)
p.anchors["a1"].lift_axis = "surface_normal"
p.anchors["a1"].lift = 1.75
p.segments = [SplineSegment(id="s", anchor_ids=list(p.anchors))]
for i, (x, speed, interp) in enumerate(
    [(0.1, 0.3, "smoothstep"), (0.4, 2, "linear"), (0.7, 4, "hold")]
):
    key = f"k{i}"
    p.motion_profile.keyframes[key] = SpeedKeyframe(
        id=key, path_position=x, speed=speed, interpolation_to_next=interp
    )
p.scene_points["point"] = ScenePoint(id="point", label="Subject", position=(2, 3, 4))
p.camera_track.default_aim = LookAtPointAim(scene_point_id="point")
add(p)
root = Path(__file__).resolve().parents[1]
(root / "crates/core/tests/fixtures/trajectory_golden.json").write_text(
    json.dumps(cases, separators=(",", ":")) + "\n"
)
print("Exported", len(cases), "Python trajectory references")
