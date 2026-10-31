---
name: backend-specs-first
description: Plan, implement or review Camera Path backend changes through a specification PR followed by a separate implementation PR, using backend/SPECS.md as the primary contract.
---

# Backend specification workflow

## Authority

Read `backend/SPECS.md` from the repository root before making backend decisions.
It is the primary specification from which the entire backend should be
reconstructable: behavior, data, contracts, validation, errors, persistence and
system boundaries must not depend on undocumented choices hidden in existing code.

Code implements the specification; tests verify conformance. OpenAPI and client
contracts must agree with it. Existing behavior, READMEs and task documents provide
evidence and context, but do not silently override specified behavior. Identify
missing or contradictory requirements rather than inventing them or treating an
implementation bug as the contract.

## Two separate pull requests

1. **Specification PR.** Describe the intended backend change in `backend/SPECS.md`
   first, preserving existing requirement identifiers and assigning new ones where
   needed. Cover affected inputs, results, errors, data, compatibility, migrations
   and observable acceptance criteria. Keep implementation and test-code changes
   out of this PR. Present the specification for review before implementing it.
2. **Implementation PR.** After the specification is accepted and implementation
   is requested, implement the agreed requirements in a separate PR. Link the
   specification PR and affected requirement identifiers. Update the necessary
   code, migrations, generated contracts and tests, and report conformance checks
   and any remaining discrepancies.

A specification edit alone does not authorize coding, merging or deployment.
If implementation reveals that a requirement needs to change, return to a separate
specification PR rather than silently amending the contract alongside the code.
This two-PR workflow governs new work even if older process text describes
updating the specification in the implementation PR; do not rewrite specification
text merely to restate the workflow unless requested.

## Verification

Choose checks from the affected requirements. Use the standalone `integration/`
HTTP suite for backend API compatibility and real password/email-code authentication;
see `integration/README.md` for isolated execution and its limits. Add focused
coverage where the accepted specification requires behavior not yet checked.
Passing existing tests is evidence of covered behavior, not proof that every
requirement is implemented.
