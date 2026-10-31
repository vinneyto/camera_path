# Camera Path

Monorepo for an AI-assisted 3D camera-path editor.

The backend implementation contract is [SPECS.md](SPECS.md). Update the specification
first, then implement the requested requirements in code and verify them with tests.
Planned changes are marked separately from the current contract.

```text
camera_path/
├── backend/     # FastAPI application, geometry compiler, agent and tests
└── frontend/    # Next.js camera-path editor
```

Run both applications in separate terminals:

```bash
cd backend && uv sync && uv run uvicorn camera_path.api:app --reload
cd frontend && npm install && npm run dev
```

See [`backend/README.md`](backend/README.md) and [`frontend/README.md`](frontend/README.md)
for configuration and development commands.

## AWS infrastructure

See [infra/README.md](infra/README.md) for the CDK stack, GitHub-based EC2 releases,
SQLite recovery and local access to the S3 library.

### Experimental LiDAR timeline

Select a trajectory, open **Add effect → LiDAR**, then edit **Vertical angle (°)**,
**Azimuth samples**, and **Elevation samples** in its controls. Apply saves the
configuration to the project. The timeline has exactly one presence marker at
position zero; removing that marker disables the sensor. Settings are static for
the whole trajectory, with no interpolation or additional LiDAR keyframes.

The horizontal span is 360°. A vertical angle of 60° samples elevation from
−30° to +30°, leaving both polar caps out. Width and height are angular sample
counts; rays run through bin centers. Defaults are 512 × 32 rays over 60°.
The origin and basis follow the evaluated trajectory camera (+X right, +Y up,
−Z forward), including aim and orientation tracks. Hit spheres are visible both
in trajectory overview and in camera playback, regardless of inspector selection.

The WebGPU adapter owns a second `GaussianPass` with an angular Jacobian and
`dataMode: "external"`. It reads the same active Gaussian selection as the main
view. It does **not** request an independent backend camera, mipmap selection or
spherical frustum. Coverage outside the main view can therefore be missing or
coarse. The dependency is pinned to renderer PR
[3dgs_tile_webgpu #49](https://github.com/vinneyto/3dgs_tile_webgpu/pull/49),
which implements the abstract API from #48.

An internal transparent pipeline node depends on the managed main Gaussian pass,
then renders the sensor pass and dispatches GPU hit reconstruction before the
transparent scene stage. Ranges use float32 scene units (meters in a metric
scene), weighted by alpha with a 0.95 coverage threshold, over 0.01–10,000 m.
`Infinity` means no return; no validity texture or per-frame CPU readback is used.
The GPU buffer drives instanced spheres with a 0.025 m radius. No-return instances
collapse to zero size. Hits do not participate in picking or autofocus.

Configuration is exposed through GET/PATCH/DELETE
`/api/v1/projects/{project_id}/camera/lidar`, with the usual editor authorization
and project ETags on mutations. Existing projects start without a sensor.
Alembic migration `20261011_0012` adds its normalized singleton record. Deletion,
configuration changes, unmount and backend replacement release pass, texture,
compute, geometry and material resources. The Spark example has no LiDAR support.

## SIFT detection lab

The standalone **SIFT lab** page ports the notebook detector to Burn WebGPU/WASM,
with a Three.js camera preview and a native JSON CLI. See
[`rust/sift/README.md`](rust/sift/README.md) for setup, timing metrics and checks.
