# CP-113: upstream Spark worker experiment

This draft starts from camera_path main `5e42ca8f`. The companion
[renderer draft](https://github.com/vinneyto/3dgs_tile_webgpu/pull/57) starts from
renderer main `6d373876`. No AWS or deployment configuration changes are needed.

The WebGPU scene adapter selects the experimental worker only when the project
URL contains `?gaussianBackend=spark`. The saved renderer preference must also
select WebGPU. Without that query parameter the existing backend remains active.
Add `&gaussianBackendDebug=1` for worker timing and transfer diagnostics.

Spark's complete Rust tree is copied unchanged at
`f5368253780bed4d863c96b1fdea9dd3d614d131`. A typed serial TypeScript worker
adapter owns decoding, LOD traversal, buffer ownership and upload acknowledgements.
The renderer consumes native Spark SH packing and LOD opacity. See the companion
repository's `docs/upstream-spark-experiment.md` for the contract, provenance
hashes, raw CPU measurements and limitations.

## Local linked checkout

Keep the two repositories in sibling directories. Build the renderer first,
then install camera_path frontend dependencies and link the renderer into
`frontend/node_modules/3dgs-tile-webgpu`. Both must resolve the same Three.js
installation; replace the renderer's `node_modules/three` with a symlink to
camera_path's `frontend/node_modules/three`.

Set in the frontend's ignored `.env.local`:

```dotenv
CAMERA_PATH_BACKEND_URL=http://127.0.0.1:8001
CAMERA_PATH_RENDERER_SOURCE=../../3dgs_tile_webgpu
```

The source setting expands Turbopack's filesystem root so it can follow the
sibling package symlink. It is unnecessary for the committed Git dependency.
`agentRules: false` keeps Next from regenerating this repository's maintained
`AGENTS.md`.

## Isolated local PLY fixture

Use a fresh local SQLite database and local file storage. Do not point this
fixture at a production database or bucket. The helper rejects non-SQLite URLs.
From `backend/`, copy your PLY to `experiment-library/mug.ply`, then set:

```dotenv
CAMERA_PATH_DATABASE_URL=sqlite+aiosqlite:///experiment.sqlite3
CAMERA_PATH_LIBRARY_DIRECTORY=experiment-library
CAMERA_PATH_AWS_LIBRARY_STORAGE=local
CAMERA_PATH_CORS_ORIGINS=http://127.0.0.1:3001
CAMERA_PATH_AUTH_EMAIL_DELIVERY=smtp
CAMERA_PATH_AUTH_SMTP_HOST=127.0.0.1
CAMERA_PATH_AUTH_SMTP_PORT=1025
```

Seed the fixture using the backend's virtual environment:

```sh
PYTHONPATH=src python ../tools/experiments/cp113_seed.py \
  --database sqlite+aiosqlite:///experiment.sqlite3 \
  --ply experiment-library/mug.ply
PYTHONPATH=src python -m uvicorn camera_path.api:create_app --factory --host 127.0.0.1 --port 8001
```

Start the frontend with `npm run dev -- --hostname 127.0.0.1 --port 3001`.
Open:

http://127.0.0.1:3001/projects/cp113-spark-experiment?gaussianBackend=spark&gaussianBackendDebug=1

The helper creates a read-only guest-accessible project with four anchors and a
trajectory, references the local PLY, and enables WebGPU for the local dev profile.
No model or database files are included in the PR.

## Validation and limits

The existing `frontend/public/mug.ply` from the user's checkout was tested:
118,979,779 bytes; 479,751 SH3 splats. The scene loaded, trajectory playback
completed, and return to orbit kept the image. The frontend's 342 tests pass,
including explicit opt-in selection; the renderer's 199 tests pass. API generation,
module map, package boundaries, types, lint, formatting and the production build
also pass. The renderer draft's CI is green.

CPU-only measurements in the renderer draft show median camera updates of
50.88 ms versus 113.98 ms on this Mac. The cuts differ, so this does not establish
equal-quality FPS improvement. Initial resident nodes increase from 395,237 to
652,218. Full-tree residency is the main memory limitation.

Source attribute editing, live mipmap changes, and out-of-core streaming are
unsupported in this prototype. The baseline remains available by removing the
query parameter and reloading.
