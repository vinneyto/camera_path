# Frontend source structure

- Keep one top-level React component, hook, or standalone function per source file.
- A component's props interface or type may stay in the same file as that component.
- A provider module may keep its provider component, context, provider props and types, and companion hook together in one file.
- Local callbacks that are implementation details of a single component may stay inside that component.
- Move sibling components and reusable helpers into dedicated files instead of accumulating them in a page, widget, or feature module.
- Keep scene features renderer-agnostic. Renderer-specific imports belong only in the matching scene-surface adapter.
- Support both the production WebGL viewport and the opt-in WebGPU viewport. Prefer shared Three.js primitives; when custom shader logic is necessary, prefer TSL only after verifying it works with both active renderer paths.
