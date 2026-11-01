---
name: backend-specs-first
description: Plan, implement or review Camera Path backend changes through a specification commit followed by explicitly authorized implementation, optionally in the same PR, using backend/SPECS.md as the primary contract.
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

## Two stages, optionally in one pull request

1. **Specification commit.** Describe the intended backend change in `backend/SPECS.md`
   first, preserving existing requirement identifiers and assigning new ones where
   needed. Cover affected inputs, results, errors, data, compatibility, migrations
   and observable acceptance criteria. Keep implementation and test-code changes
   out of this commit. Present the specification for review and wait for the
   user's explicit go-ahead before implementing it. The PR may remain open for
   the next stage.
2. **Implementation after go-ahead.** Once the user explicitly authorizes
   implementation, add the agreed code and tests in subsequent commits. These
   commits may be in the same PR as the specification; a separate implementation
   PR is also allowed. Reference the accepted specification commit and affected
   requirement identifiers. Update the necessary code, migrations, generated
   contracts and tests, and report conformance checks and any remaining discrepancies.

A specification edit or review alone does not authorize coding, merging or deployment.
If implementation reveals that a requirement needs to change, make a separate
specification commit and obtain the user's go-ahead before implementing that change.
Do not silently combine new requirements with their implementation in one commit.

## Verification

Choose checks from the affected requirements. Use the standalone `integration/`
HTTP suite for backend API compatibility and real password/email-code authentication;
see `integration/README.md` for isolated execution and its limits. Add focused
coverage where the accepted specification requires behavior not yet checked.
Passing existing tests is evidence of covered behavior, not proof that every
requirement is implemented.
