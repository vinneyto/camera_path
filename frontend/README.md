# Camera Path frontend

Next.js, TypeScript and React Three Fiber editor for the Camera Path API. The source follows
Feature-Sliced Design layers: route composition in `app`, business actions in `features`, domain
models in `entities`, large interface blocks in `widgets`, and reusable code in `shared`.

## Frontend architecture

The state is intentionally split by ownership instead of being placed in one global store:

- TanStack Query owns server state: project lists, projects, compiled trajectories, request status,
  cache updates, and optimistic chat messages. Query hooks live in `entities/project`; mutations live
  beside the user action in `features`.
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

Start the backend first, then:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open <http://localhost:3000>. `NEXT_PUBLIC_API_URL` points the browser at the FastAPI server.
The backend must have `OPENAI_API_KEY` configured for chat; project and anchor APIs work without it.

## Checks

```bash
npm run test
npm run lint
npm run build
```

Select the anchor tool (or hold Shift), click a scene surface to set its base, then click again to
place the anchor above or below that surface along the world Y axis. Insert the resulting anchor
token into chat, ask the agent to build a spline or spiral, then click the rendered trajectory to
open its speed and camera-aim panels. Playback uses the compiled speed profile and camera direction
track.
