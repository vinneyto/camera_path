# Frontend source structure

- Keep one top-level React component, hook, or standalone function per source file.
- A component's props interface or type may stay in the same file as that component.
- When a component renders a Three.js/R3F object, derive its standard object, transform, and event props from the matching `ThreeElements[...]` type. Add only domain-specific props instead of manually repeating R3F event handlers.
- A provider module may keep its provider component, context, provider props and types, and companion hook together in one file.
- Local callbacks that are implementation details of a single component may stay inside that component.
- Move sibling components and reusable helpers into dedicated files instead of accumulating them in a page, widget, or feature module.
- Keep each contributed command and each rendering effect in its own source file. A command component renders one `Command`; do not group several commands/effects in one implementation or aggregate wrapper. List command components individually in the feature slots object so reviewers can see each contribution and its dependencies. Keep an effect's resource setup, registration and cleanup together. This rule concerns contributed effects, not individual React effect hooks inside one resource owner.
- Keep scene features renderer-agnostic. Renderer-specific imports belong only in the matching scene-surface adapter.
- Default to Spark/WebGL when no renderer preference is saved; preserve an explicit WebGPU choice.
- Keep renderer-specific behavior in its adapter. Changing the default does not require unrelated feature-parity work; unsupported adapter operations must report clear errors.
- Prefer TSL when custom shader logic is required for the supported WebGPU path.
- Create disposable Three.js/GPU resources and dispose them in the setup and cleanup of the same `useEffect`. Do not create or memoize such a resource with `useMemo` and dispose it from a separate effect: React Strict Mode may run the effect cleanup and setup again while retaining the memoized resource, causing reuse after `dispose()`.
- Do not create a ref only to carry the latest prop or state value into an effect. When the resulting update is cheap, apply it directly in a `useEffect` or `useLayoutEffect` and list the value in that effect's dependencies.
- React Compiler is enabled for the frontend. Do not add `useMemo`, `useCallback`, or `memo` by default. Add manual memoization only when stable identity is required by an external API or a measured performance case justifies it; keep the reason explicit in the code.

# Package boundaries

- Follow `docs/feature-packages.md`. Keep `src/app` as the Next/Vercel entrypoint and host composition in `apps/host`.
- `store` contains state and selectors only. `actions` owns state changes, server mutations and their business effects. `api` owns HTTP, generated DTO clients, session and query hooks. These shared packages must not depend on features or host.
- Each feature lives in its own `packages/features/<name>` workspace. Features import shared packages and their own implementation only; never another feature or host. Read state/actions/API/theme through shared hooks. `useFrame` is allowed.
- Features read editor data through `useCameraState`, `usePlaybackState`, `useEditorTool`, `useSceneInteraction`, `useUserSettings` (plus resource scope hooks). Do not import the raw store API, generic root-state selector, `EditorState`, store internals or Zustand in feature code. Store creation, providers and imperative store access belong to shared infrastructure/host; mutations belong to actions. Preserve event/animation lifetimes when subscribed values change.
- Public feature entrypoints export one `slots` object using `as const satisfies FeatureSlots` from `@camera-path/slots`. Every section/slot is optional and contains ready components without required props. Host imports these objects only in its composition catalog and mounts them with typed `<Slot name="section.slot" />` containers. Keep nested multi-feature layout in host.
- Keep slot mounting a plain React context over the static feature catalog. Do not add feature manifests, registration/activation protocols, request dispatchers or manifest permission frameworks. Catalog order and the feature's local array order define mounting order. Host owns providers and creates each project's Zustand store/actions and the application's API query client.
- Command palette, registration and command types belong to the shared `commands` package. Host mounts `CommandsProvider`; each feature command component returns one `Command` element with data/callback props. Keep registration hooks private to that package.
- Generic WebGPU Canvas, RenderPipeline provider, pass registration/compositing and layer/picking rules belong to the shared `render-pipeline` package. It depends only on React, R3F and Three.js. Consumers import it directly; do not forward its exports through scene-runtime.
- Keep renderer-specific Gaussian/LiDAR code in scene-runtime adapters. Preserve the existing renderer dependency and GPU resource lifecycle.
- Keep `docs/frontend-modules.json` current with `npm run modules:scan` when frontend contributions or action/data dependencies change. Do not edit the generated report by hand; `modules:check` verifies it in CI. See `docs/frontend-module-map.md`.
- Run API generation checks, module map freshness, package boundaries, typecheck, lint, tests, build and formatting checks before delivering architectural changes.

- User preferences live in the application-scoped Zustand settings store. Host creates the store and its actions above project scopes. Features read `useUserSettings` from store and call `useUserSettingsActions` from actions; API provides only HTTP clients for these settings. Loading, local persistence, saving, status changes and renderer reloads belong to actions.
