# Camera Path

Monorepo for an AI-assisted 3D camera-path editor.

Backend behavior is defined by its Python models, routes, services and tests.
OpenAPI and the generated frontend client describe the HTTP interface.

```text
camera_path/
├── backend/     # FastAPI application, geometry compiler, agent and tests
├── frontend/    # Next.js camera-path editor
├── generation/  # Standalone Trellis worker
├── infra/       # AWS deployment
├── integration/ # HTTP and RabbitMQ integration tests
└── rust/sift/   # SIFT detector, WASM module and native CLI
```

## Local development

Install `uv`, Node.js 24 or newer, Rust 1.95 or newer via `rustup`, and Docker
with Compose. Open the repository root in VS Code and choose **Tasks: Run Task**.

1. **Dev Setup** installs the Python and npm dependencies, prepares the WASM
   toolchain, creates missing environment files and runs the database migrations.
   For a new database it prompts for the editor's email and password. On Apple
   Silicon it also offers to set up Trellis and download missing text/image model weights.
2. **Dev Start** launches **Dev Frontend**, **Dev Backend** and **Dev Trellis** in
   separate terminals. Backend and Trellis tasks first start the shared RabbitMQ
   and Mailpit containers. Trellis runs when local generation is configured.

Start, stop or restart each service through its own task and view its logs in its
dedicated terminal. Use **Tasks: Terminate Task** to stop a service, or choose
**All** to stop all running tasks.

Open [the editor](http://127.0.0.1:3000) and use
[Mailpit](http://127.0.0.1:8025) to read the email confirmation code. The backend API
listens on `127.0.0.1:8000`. RabbitMQ and Mailpit stay up between launches.

From the repository root, the terminal launcher also supports starting the full stack.
Press Ctrl+C to stop its application processes.

```bash
./scripts/dev.sh setup
./scripts/dev.sh start
```

For separate terminals, use `./scripts/dev.sh infrastructure` once, then launch
`./scripts/dev.sh frontend`, `./scripts/dev.sh backend` and
`./scripts/dev.sh trellis` in their own terminals.

After pulling a schema change, run just the migrations with `./scripts/dev.sh migrate`.
New clones use SQLite and filesystem storage under `backend/.dev/`.

All clones share the RabbitMQ and Mailpit containers. **Dev Setup** enables RabbitMQ
and assigns queues with a prefix derived from the clone's absolute path, such as
`camera-path.a1b2c3d4e5f6.generation.requests`. It writes matching queue names to
`backend/.env` and `generation/.env` before the editor and Trellis prompts.
Repeated setup in the same directory keeps the same queue names.
Rerun **Dev Setup** to update a clone prepared before this change. Messages already
sent to its previous queues stay in those queues.

Opting in to Trellis also configures the backend's broker URL and output path to
match `generation/.env`. Dev Setup also enables `CAMERA_PATH_GENERATION_DEFAULT_ROTATION_DEG=[180,0,0]`
for new generated assets when no rotation is configured, and preserves custom values.
For simultaneous local instances, choose different HTTP ports.

```bash
CAMERA_PATH_DEV_BACKEND_PORT=8019 CAMERA_PATH_DEV_FRONTEND_PORT=3019 ./scripts/dev.sh start
```

See [`backend/README.md`](backend/README.md) and [`frontend/README.md`](frontend/README.md)
for configuration and development commands.

See [generation/README.md](generation/README.md) to run and test the standalone Trellis worker.

## AWS infrastructure

See [infra/README.md](infra/README.md) for the CDK stack, GitHub-based EC2 releases,
SQLite recovery and local access to the S3 library.

## Experimental LiDAR timeline

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
coarse. Enable WebGPU in **Profile & settings** to use LiDAR.

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
