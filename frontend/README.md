# Camera Path frontend

Next.js, TypeScript and React Three Fiber editor, split into npm workspace packages.
The host lives in `apps/host`, with Next/Vercel routes retained in `src/app`.

## Frontend architecture

See [Пакеты frontend и типизированные слоты](docs/feature-packages.md) for package dependencies,
providers, the full feature/slot map and review entrypoints.

- `store` contains project-scoped Zustand state; `actions` contains its synchronous updates and
  server mutations. `api` owns transport, auth/preferences and React Query resource hooks.
- Each `features/*` package owns its UI and behavior, imports shared hooks, and exports an optional typed `slots` object
  containing ready React components without required props. Features do not import the host or one another.
- Host loads the slot objects in one catalog and mounts `<Slot name="project.scene" />` and
  other typed containers. A plain React context selects components; there is no feature manifest
  or registration/activation protocol.
- Server resources remain in React Query. Local transient inputs remain inside their feature.
- `trajectory-math` contains pure geometry and motion functions; `scene-runtime` contains renderer
  adapters and neutral viewport services; `ui-kit` contains shared UI and theme.

## Run

The project viewport defaults to Spark/WebGL. To use Three.js WebGPU and `3dgs-tile-webgpu`,
turn on **Use WebGPU renderer** in **Profile & settings**.
Library assets and project cloud instances are loaded from the backend. In the WebGPU viewport,
model downloads run in parallel. Each model appears independently after its Rust/WASM
mipmap cut is ready to render. Pending visible instances show a horizontal loading ring at their
saved translation: a faint full ring and a brighter progress arc. The ring diameter is 0.6 m
(the same proportions as the anchor platform, at a larger size). Download byte progress occupies
0–90%; the remaining segment stays pending during parsing, mipmap construction and render
preparation, then the ring is replaced by the model. If the server does not provide a usable total
size, the download arc rotates instead of displaying a made-up percentage.
Initial framing includes pending model positions and expands as real bounds arrive, until the
user starts orbiting/panning/zooming. Failed models do not block others; their errors remain in the
viewport. Removing a pending model or leaving the project aborts its download.
**Profile & settings** contains sign-in, renderer, grid and Gaussian DPR controls. Changing the
renderer saves the preference and reloads the current page. For editors, the save must succeed first.
The current renderer remains mounted during saving and after errors. Grid and DPR
changes continue to apply without reloading.

Visitors can browse projects, library details/downloads, scenes and playback. Chat history and the agent composer are available only to signed-in editors.
Sign in with the editor account to create/delete projects, upload/delete library assets, edit
clouds/anchors/timelines, send messages and run the agent. The backend
enforces these permissions for direct API requests too. Create the account with the backend's
`editor-create` command before signing in.

Wrap editing forms, menus and controls in `EditorOnly` at their composition boundary. Guests see
the shared content and read-only anchor markers; the anchor keyboard shortcut mounts only for editors.

`api/identity` checks the server session on startup, window focus and once a minute. A 401 drops
editor mode immediately. Settings remain available to guests. Renderer/grid/DPR choices
are always stored under `camera-path-editor-settings` in localStorage (the existing key is retained).
Local values take priority over the backend fallback, survive login/logout and session expiry, and
remain usable when backend profile reads fail. Guests only edit local preferences; editors also
publish changed fields to the backend. Failed saves show an error without reverting local choices.
The desktop sidebar and the mobile navigation menu both contain **Profile & settings** and
the theme toggle. The settings modal can be closed with its close button or Escape.

Local development uses Node.js 24 and the [SIFT toolchain](../rust/sift/README.md#local-browser-demo).
Install Rust 1.95 or newer, the WebAssembly target and `wasm-pack` before starting the frontend.

Start the backend first, then:

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

Open <http://localhost:3000>. Browser requests use same-origin `/api/v1` route handlers.
Set server-only `CAMERA_PATH_BACKEND_URL` to the FastAPI address for local development. On Vercel,
set it to the HTTPS `ApiUrl` output from the [CDK stack](../infra/README.md).
The proxy keeps JWTs in HttpOnly cookies, validates Origin on writes, forwards revision headers,
streams binary local uploads/downloads and SSE for chat and jobs, and rewrites local content URLs to itself.
Signed S3 URLs stay direct browser transfers. Production cookies require HTTPS.
The backend must have `OPENAI_API_KEY` configured for chat; project and anchor APIs work without it.

Orval generates the API client and TanStack Query hooks from `backend/openapi.json` under
`packages/api/src/client/generated` and the DTO types under `packages/types/src/api`.
After changing the backend contract, run `npm run api:generate` in `frontend` and commit the
result. The normal build never regenerates code. `api:check` verifies the committed output.
Mutations send the latest project revision as `If-Match`; the backend exposes revision ETags
to the browser. A revision conflict requires refetching the affected resources.

## Checks

```bash
npm run api:check
npm run boundaries:check
npm run modules:check
npm run typecheck
npm run format:check
npm run lint
npm test
npm run build
```

Use the anchor placement tool to create a labeled path anchor. Click an anchor's invisible cylinder
or upper pin to append `@label` to the chat draft without selecting the anchor; dragging the pin
changes its height without inserting a mention. Selecting a model or trajectory appends `@name`
once when selection changes. The draft is scoped to the project and survives closing the mobile
chat. User messages use these explicit text references, without hidden current-selection context.
Ask the agent to build a spline or spiral, then click the rendered trajectory to open its
speed and camera-aim panels. Playback uses the compiled speed profile and camera direction track.

### Gaussian backend and file formats

The `3dgs-tile-webgpu` dependency pinned in [package.json](package.json) uses a Rust/WASM
backend inside a Web Worker. Adding a cloud retains the current scene's displayed
LOD while preparing the new cloud's target cut, then activates it atomically.
Removing a cloud hides only its own active slots and retains the surviving clouds'
detail while preparing any refined replacement cut.
The first view-dependent selection uses the actual drawing-buffer dimensions.
Its npm package includes the compiled WASM and inline worker. The separate SIFT module builds
from Rust during `predev` and `prebuild`. On Vercel, the SIFT build script prepares its toolchain.
The diagnostic mode `?gaussianBackendDebug` wraps the same worker backend. GPU capacity is negotiated by
the Gaussian pass from renderer capabilities.

The library accepts PLY and self-contained `.sog` ZIP containers (SOG v1/v2). Both local
and S3 storage check the declared size and the format signature; full format decoding
is performed by the renderer. Loose `meta.json` plus separate SOG textures are unsupported.
Each loaded cloud requests a standard mipmap tree with a picking snapshot of up to
25,000 frontier Gaussians. Picking is approximate at that resolution and independent
of the current GPU draw cut. Buffer loads pass the source filename as a format hint.
URL loads pass the library asset's format explicitly through preview and project-cloud
responses, so local `/content` endpoints and signed URLs do not need a file extension.

### Dependency audit

Run `npm audit` in `frontend` to check the locked dependency tree against current advisories.
Use `npm audit --omit=dev` for the production dependency tree.

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

### Email confirmation during editor sign-in

Profile sign-in asks for the editor email/password, then a six-digit email code.
The challenge step shows expiry and resend cooldown, handles incorrect codes and
allows starting again or cancellation without retaining the password. The proxy
exposes no JWT to browser JavaScript: it creates the HttpOnly session cookie only
after successful confirmation (or explicit local off mode). Password-only challenge
responses clear any prior authenticated cookie. See the
[local Mailpit setup](../backend/README.md#local-verification-before-any-cdk-deployment) for
testing sign-in.
