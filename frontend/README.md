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

The supported product viewport uses Three.js WebGPU and `3dgs-tile-webgpu` for Gaussian splats.
Library assets and project cloud instances are loaded from the backend. The Profile settings panel
controls renderer and grid visibility; Gaussian DPR is in the project header. Unchecking the WebGPU
option selects the Spark/WebGL reference adapter, which has no feature parity guarantee.

Visitors can browse projects, library details/downloads, scenes, playback and all chat history.
Sign in with the editor account to create/delete projects, upload/delete library assets, edit
clouds/anchors/timelines, change profile settings, send messages and run the agent. The backend
enforces these permissions for direct API requests too. Create the account with the backend's
`editor-create` command before signing in.

Wrap editing forms, menus and controls in `EditorOnly` at their composition boundary. Guests see
the shared content and read-only anchor markers; the anchor keyboard shortcut mounts only for editors.

`features/auth` checks the server session on startup, window focus and once a minute. A 401 drops
editor mode immediately. Profile settings remain available to guests. Renderer/grid/DPR choices
are always stored under `camera-path-editor-settings` in localStorage (the existing key is retained).
Local values take priority over the backend fallback, survive login/logout and session expiry, and
remain usable when backend profile reads fail. Guests only edit local preferences; editors also
publish changed fields to the backend. Failed saves show an error without reverting local choices.
Profile and sign-in windows use the shared modal, with a lightly blurred overlay, focus trapping,
and dismissal by clicking outside, the close button, or Escape.

Start the backend first, then:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open <http://localhost:3000>. Browser requests use same-origin `/api/v1` route handlers.
Set server-only `CAMERA_PATH_BACKEND_URL` to local FastAPI or the HTTPS CloudFront origin;
`NEXT_PUBLIC_API_URL` is no longer used. On Vercel set the same server-side variable.
The proxy keeps JWTs in HttpOnly cookies, validates Origin on writes, forwards revision headers,
streams binary local uploads/downloads and agent SSE, and rewrites local content URLs to itself.
Signed S3 URLs stay direct browser transfers. Production cookies require HTTPS.
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

### Gaussian backend and file formats

The pinned `3dgs-tile-webgpu` revision (`a51b4f3`, upstream PR #45) uses a Rust/WASM
backend inside a Web Worker. Adding a cloud retains the current scene's displayed
LOD while preparing the new cloud's target cut, then activates it atomically.
The first view-dependent selection uses the actual drawing-buffer dimensions.
Its npm package includes the compiled WASM and inline worker, so `npm ci` and Vercel builds
do not need Rust or a separate WASM asset deployment. The diagnostic mode
`?gaussianBackendDebug` wraps the same worker backend. GPU capacity is negotiated by
the Gaussian pass from renderer capabilities.

The library accepts PLY and self-contained `.sog` ZIP containers (SOG v1/v2). Both local
and S3 storage check the declared size and the format signature; full format decoding
is performed by the renderer. Loose `meta.json` plus separate SOG textures are unsupported.
Each loaded cloud requests a standard mipmap tree with a picking snapshot of up to
25,000 frontier Gaussians. Picking is approximate at that resolution and independent
of the current GPU draw cut. Buffer loads pass the source filename as a format hint.

### Dependency audit

After the Rust/SOG integration, `npm audit --omit=dev` reports zero frontend production
vulnerabilities. `npm audit` still reports five high findings along the single development
chain `eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces`.
The root issue is [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm);
`braces` has no patched release. The suggested forced downgrade to Next.js 14 ESLint
configuration is not applied. These packages are used for linting rather than shipped
in the browser or the Next.js production server.

Next.js/ESLint config are updated to 16.4.0, Orval to 8.41.0 and Vitest to 4.1.11.
The lockfile also resolves patched `sharp`, `source-map-js` and `undici`. The infra audit
is clean after updating `aws-cdk-lib` to 2.273.0, which fixes its bundled `brace-expansion`.
Recheck using `npm audit` in both `frontend` and `infra` when updating dependencies.

### Cloud placement

All library clouds enter placement mode, including the first cloud in an empty scene.
The preview follows the nearest raycast hit on an existing visible cloud. The visible grid
is a fallback when no cloud is hit, even if it is geometrically closer: WebGPU composites
the grid underneath splats. Anchor pointer events use the same pass ordering.
When the ray misses, the preview stays at the origin; clicking confirms that default position.
Escape cancels placement. The preview is excluded from placement raycasts.

Preview and saved cloud share one keyed React/R3F owner so handing off the loaded cloud
retains pointer events and raycasting without loading the model twice.

### Agent message formatting

Assistant text is rendered with `react-markdown` and `remark-gfm`, including tables and
fenced code blocks. User messages stay literal. Raw HTML is skipped, the default safe URL
transform is retained, and external links open with `noopener noreferrer`.
Code and tables have local horizontal scroll; formatting uses the existing theme colors.
The same renderer handles partial content updates and saved history without changing message
content or the existing chat request transport.
