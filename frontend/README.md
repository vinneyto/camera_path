# Camera Path frontend

Next.js, TypeScript and React Three Fiber editor for the Camera Path API. The source follows
Feature-Sliced Design layers: route composition in `app`, business actions in `features`, domain
models in `entities`, large interface blocks in `widgets`, and reusable code in `shared`.

## Frontend architecture

The state is intentionally split by ownership instead of being placed in one global store:

- TanStack Query owns server state: project metadata, anchors, scene points, editable and compiled
  trajectories, timelines, and chat messages are cached under separate resource keys. Query hooks
  live in `entities/project`; mutations live beside the user action in `features`.
- Zustand owns synchronous editor state shared by several interface blocks: playback position,
  elapsed time, play/pause, and trajectory selection. It lives in `features/project-editor` and does
  not copy project data from the query cache.
- Local component state is reserved for temporary input such as the current chat draft or project
  name.

Each FSD slice exposes a public API through its root `index.ts`. Cross-slice imports use those public
APIs, while files inside a slice use relative imports. Route composition therefore reads as
`app -> widgets -> features -> entities -> shared`; lower layers do not depend on interface widgets.

Trajectory geometry stays in pure functions under `entities/trajectory`. Camera lookup uses the
backend's adaptive arc-length table to map normalized path distance back to Bezier `t`. This keeps
camera speed uniform along curved segments, avoids treating Bezier `t` as physical distance, and
keeps the backend compiler as the single source of geometry sampling truth.

## Run

Place a canonical 3DGS file at `public/mug.ply`. The same frontend-only cloud is loaded for every
project; the backend does not store or configure it yet.

The supported product viewport uses Three.js WebGPU and `3dgs-tile-webgpu` for Gaussian splats.
The Spark/WebGL adapter remains in the repository only as an example of an alternative renderer
integration. It is not a supported product path, does not need feature parity, and may throw explicit
errors for unsupported operations. `?renderer=webgl` can still be used when working specifically
with that reference implementation.

Start the backend first, then:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open <http://localhost:3000>. `NEXT_PUBLIC_API_URL` points the browser at the FastAPI server.
The backend must have `OPENAI_API_KEY` configured for chat; project and anchor APIs work without it.

The frontend API client, types, and TanStack Query hooks are generated from
`backend/openapi.json` with Orval and committed under `src/shared/api/generated`.
After changing the backend contract, run `npm run api:generate` in `frontend` and commit the
result. The normal build never regenerates code. `api:check` verifies the committed output.
Mutations send the latest project revision as `If-Match`; the backend exposes revision ETags
to the browser. A revision conflict requires refetching the affected resources.

## Checks

```bash
npm run test
npm run lint
npm run api:check
npm run build
```

Click the Gaussian cloud to create a labeled path anchor. Insert the resulting anchor token into
chat, ask the agent to build a spline or spiral, then click the rendered trajectory to open its
speed and camera-aim panels. Playback uses the compiled speed profile and camera direction track.
