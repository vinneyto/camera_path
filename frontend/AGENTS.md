# Frontend source structure

- Keep one top-level React component, hook, or standalone function per source file.
- A component's props interface or type may stay in the same file as that component.
- A provider module may keep its provider component, context, provider props and types, and companion hook together in one file.
- Local callbacks that are implementation details of a single component may stay inside that component.
- Move sibling components and reusable helpers into dedicated files instead of accumulating them in a page, widget, or feature module.
