# Camera Path

Monorepo for an AI-assisted 3D camera-path editor.

Backend behavior is defined by its Python models, routes, services and tests.
OpenAPI and the generated frontend client describe the HTTP interface.

```text
camera_path/
├── backend/     # FastAPI application, geometry compiler, agent and tests
├── frontend/    # Next.js camera-path editor
├── cli/         # Camera Path device login and local inference worker
├── generation/  # Trellis 3D model runner
├── painter/     # FLUX 2D model runner
├── infra/       # AWS deployment
├── integration/ # HTTP integration and legacy compatibility tests
└── rust/sift/   # SIFT detector, WASM module and native CLI
```

## Local development

Install `uv`, Node.js 24 or newer, Rust 1.95 or newer via `rustup`, and Docker
with Compose. Open the repository root in VS Code and choose **Tasks: Run Task**.

1. **Dev Setup** installs the Python and npm dependencies, prepares the WASM
   toolchain, creates missing environment files and runs the database migrations.
   For a new database it prompts for the editor's email and password. On Apple
   Silicon it offers to prepare the Painter and Trellis model environments and weights.
2. **Dev Start** launches **Dev Frontend**, **Dev Backend**, and Mailpit. Inference
   is optional and runs in a separate **Dev Local Inference** task after device login.
3. Open [the editor](http://127.0.0.1:3000), and use [Mailpit](http://127.0.0.1:8025)
   if an email code is needed. Sign in to the CLI against this dev instance:

   ```bash
   uv run --project cli camera-path --profile dev login
   ```

   Compare the code in the terminal and browser before approving. Run
   **Dev Local Inference**, or use the CLI manually:

   ```bash
   uv run --project cli camera-path --profile dev worker
   ```

   One worker handles both prepared model families serially. Missing model
   weights can be downloaded separately with:

   ```bash
   uv run --project cli camera-path download-weights
   ```

Run the application from a terminal instead with `./scripts/dev.sh setup` and
`./scripts/dev.sh start`. Ctrl+C stops its application processes. Mailpit stays
up. For separate terminals, run `./scripts/dev.sh infrastructure` once, then
`./scripts/dev.sh frontend` and `./scripts/dev.sh backend`.

New clones use SQLite and file storage under `backend/.dev/`. If you are
switching an existing RabbitMQ dev clone, let its existing workers drain and
stop them first, then run **Dev Setup** to change that clone to the CLI transport.
Do not run old and new workers for the same jobs during cutover. The setup
preserves an existing explicit image provider selection; set
`CAMERA_PATH_IMAGE_GENERATION_PROVIDER=painter` in `backend/.env` for local
Painter, `openai` for explicit server-side image generation, or `none` to
disable image jobs. This selection is separate from the chat model. Independent
SQS library imports are not changed by the CLI.

Choose unique ports if running dev clones simultaneously. Set the same
environment for app start, CLI login and worker:

```bash
export CAMERA_PATH_DEV_BACKEND_PORT=8019 CAMERA_PATH_DEV_FRONTEND_PORT=3019
./scripts/dev.sh start
```

Always pass `--profile dev` during development; the CLI otherwise targets
production. After pulling a schema change, run `./scripts/dev.sh migrate`.
See [backend](backend/README.md) and [frontend](frontend/README.md) setup docs
and the [Trellis](generation/README.md) and [Painter](painter/README.md) runner docs.

## AWS infrastructure

See [infra/README.md](infra/README.md) for the CDK stack, GitHub-based EC2 releases,
SQLite recovery and local access to the S3 library.

## Experimental LiDAR timeline

Select a trajectory, choose **LiDAR: Add** in the command palette, then edit **Vertical angle (°)**,
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

Both WebGL/Spark and WebGPU use the same scene-depth capture contract: six
90° float32 views from the sensor pose, sampled into an angular `R32F` range
texture. Face resolution follows the azimuth sample count (128 × 128 per face
at the defaults). Face view-Z is converted to radial meters along each bin's
ray. Nearest sampling preserves misses and depth discontinuities; `Infinity`
means no return, over a 0.01–10,000 m range. Grid, overlays, helper objects,
transparent meshes and meshes with depth writing disabled are excluded.

The surface rule follows Spark's render-cube-depth example: source Gaussian
opacity must exceed 0.1; surviving Gaussians have opaque two-sigma footprints,
with no added screen-space blur. Ordinary opaque meshes contribute their own
depth and occlude Gaussians (and vice versa). This is an approximate Gaussian
surface, rather than accumulated-opacity depth or a physical LiDAR simulation.

Spark uses its public custom-shader API and borrowed source textures. WebGPU
uses a separate full-source store, so the sensor does not inherit the editor
camera's visible LOD selection. That independent store increases memory use;
its input buffers are retained until the cloud is removed. Captures that exceed
the device budget or have incomplete Gaussian output cannot produce partial hits.

The common owner captures at most 20 times per second, reads the float faces
back to the CPU, and reconstructs world-space instanced hit spheres with a
0.01 m radius and 50% opacity. One capture runs at a time, preserving its own pose
until the readback completes. Hits do not participate in picking, autofocus or
depth capture.
This CPU readback is deliberate and may limit performance on large scenes.

Configuration is exposed through GET/PATCH/DELETE
`/api/v1/projects/{project_id}/camera/lidar`, with the usual editor authorization
and project ETags on mutations. Existing projects start without a sensor.
Alembic migration `20261011_0012` adds its normalized singleton record. Deletion,
configuration changes, unmount and backend replacement release pass, texture,
compute, geometry and material resources, after pending GPU readbacks settle.

## SIFT detection lab

The standalone **SIFT lab** page ports the notebook detector to Burn WebGPU/WASM,
with a Three.js camera preview and a native JSON CLI. See
[`rust/sift/README.md`](rust/sift/README.md) for setup, timing metrics and checks.
