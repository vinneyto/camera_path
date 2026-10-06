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
The Profile settings panel on the project list and in the project header controls the renderer
and grid visibility for all projects. Both settings default to enabled and are saved on the backend
for the current user, then restored when the app opens in any browser. Uncheck the WebGPU option
to switch to the Spark/WebGL reference adapter. Spark does not
have feature parity with the supported WebGPU renderer and may throw explicit errors for unsupported
operations.

`features/user-settings` owns the shared profile query and mutation. Controls show loading,
saving and error states; scene preferences change only after a successful server response.
The old renderer localStorage value is ignored. Gaussian DPR remains a session-only setting.

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

### Cloud placement

All library clouds enter placement mode, including the first cloud in an empty scene.
The preview follows the nearest raycast hit on an existing visible cloud. The visible grid
is a fallback when no cloud is hit, even if it is geometrically closer: WebGPU composites
the grid underneath splats. Anchor pointer events use the same pass ordering.
When the ray misses, the preview stays at the origin; clicking confirms that default position.
Escape cancels placement. The preview is excluded from placement raycasts.

Preview and saved cloud share one keyed React/R3F owner so handing off the loaded PLY
retains pointer events and raycasting without loading the model twice.

### Agent message formatting

Assistant text is rendered with `react-markdown` and `remark-gfm`, including tables and
fenced code blocks. User messages stay literal. Raw HTML is skipped, the default safe URL
transform is retained, and external links open with `noopener noreferrer`.
Code and tables have local horizontal scroll; formatting uses the existing theme colors.
The same renderer handles partial content updates and saved history without changing message
content or the existing chat request transport.
