# Camera Path project instructions

## Backend development

Use [the backend specification workflow](.agents/skills/backend-specs-first/SKILL.md)
when planning, implementing or reviewing backend changes.

`backend/SPECS.md` is the primary backend contract. It must contain enough behavioral,
data and boundary requirements to recreate the backend, rather than requiring the
current implementation to fill in undocumented product decisions.

New backend changes follow two separate pull requests: first the specification,
then implementation and tests against the accepted specification. Editing a spec
does not authorize implementation. Do not combine new requirements with their
implementation in the same PR.
