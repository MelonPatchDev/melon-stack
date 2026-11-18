# Systemic changes (H tier)

**H is for changes whose break would be systemic and hard to undo:** formula code behind the numbers users act on, the stored format, auth. Reading these for errors is expensive, so the rules below turn them into tests, and the reviewer reads only the focus files in depth. The repo's own rules for these areas (how results are versioned, what's immutable, how restores are drilled) are in its `CLAUDE.md`.

## Formula code (any number users see or act on)
1. **The rules come first.** If the repo keeps a rules doc (`audits.rulesDoc`: how numbers are computed now), a rule change edits it in this PR, with the before and after quoted under Decisions. Rule changes (as opposed to clarifications) are labelled `owner-review`; with `gate.ownerReviewBlocks` set, the label holds the merge.
2. **Golden tests.** In its TEST PLAN, the reviewer **computes the expected values independently, with a throwaway script written from the rules doc** (never from the code under change), for 2–4 small cases (the simplest, a partial one, an empty or zero-length one, one with a missing input). The builder encodes them as fixtures. When the code and a hand-computed value disagree, the rules doc settles it. Never change the expected number to match the code.
3. **Property-based tests** for the invariants the rules doc states.

## Stored formats (schema, migrations, raw stores, serialized outputs)
1. **One migration in flight.** `melon gate` enforces it. If another PR holds it, stop at your checkpoint.
2. **Additive first.** Add, backfill idempotently, then switch readers. Destructive steps go in a later issue.
3. **Idempotent writes:** a test that runs the same input twice (and in a different order where order could matter) and gets the same rows.

## Auth and access
1. **Default deny.** A new route or reader is behind the guard unless the brief names it public, with a test that a signed-out request is refused.
2. **No new user data or third party** without the owner's decision (`needs-owner`).
3. **Redirects, origins and cookies:** test the hostile case (an open redirect, a cross-site write), not only the happy path.
