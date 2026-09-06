# Frontend source structure

- Keep one top-level React component, hook, or standalone function per source file.
- A component's props interface or type may stay in the same file as that component.
- A provider module may keep its provider component, context, provider props and types, and companion hook together in one file.
- Local callbacks that are implementation details of a single component may stay inside that component.
- Move sibling components and reusable helpers into dedicated files instead of accumulating them in a page, widget, or feature module.
- Keep scene features renderer-agnostic. Renderer-specific imports belong only in the matching scene-surface adapter.
- Treat the WebGPU viewport backed by `3dgs-tile-webgpu` as the only supported product rendering path.
- Keep the Spark/WebGL adapter only as a renderer-integration example. It does not need feature parity or production completeness; unsupported operations may use explicit stubs that throw clear errors.
- Do not spend effort extending or tuning the Spark path unless a task explicitly requests it.
- Prefer TSL when custom shader logic is required for the supported WebGPU path.
