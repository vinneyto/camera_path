# Camera Path project instructions

## Backend development

Use [the backend specification workflow](.agents/skills/backend-specs-first/SKILL.md)
when planning, implementing or reviewing backend changes.

`backend/SPECS.md` is the primary backend contract. It must contain enough behavioral,
data and boundary requirements to recreate the backend, rather than requiring the
current implementation to fill in undocumented product decisions.

Backend changes have two stages, which may share one pull request. First make a
separate commit updating `backend/SPECS.md`. Wait for the user's explicit go-ahead
before adding implementation and tests in subsequent commits. A specification
edit or review alone does not authorize implementation. Keep specification and
implementation changes in separate commits even when they are in the same PR.
