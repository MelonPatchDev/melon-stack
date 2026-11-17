# Systemic changes (H tier)

**H is for changes whose break would be systemic and hard to undo:** formula code behind the numbers users act on, the stored format, auth. Reading these for errors is expensive, so this playbook turns them into tests, and the reviewer reads only the focus files in depth.

## Formula code (any number users see or act on)
1. **The rules come first.** If the repo keeps a numbered rules doc (`audits.rulesDoc`: a reference doc describing how numbers are computed now), a rule change edits it in this PR, with the before and after quoted under Decisions. Rule changes (as opposed to clarifications) are labelled `owner-review`.
2. **Golden tests.** In its TEST PLAN, the reviewer **computes the expected values by hand, independently**, for 2–4 small cases (the simplest case, a partial case, a zero-length or empty case, a missing input). The builder encodes them as fixtures. When the code and a hand-computed value disagree, the rules doc settles it. Never change the expected number to match the code.
3. **Property-based tests** (fast-check or the language's equivalent) for the invariants, for example:
   - scaling every input leaves ratios unchanged;
   - no input means "no value", never 0;
   - recomputing twice gives the same rows;
   - an estimate always lies within its stated range.
4. **Version the output.** If stored results change, bump the repo's results version and say how existing rows are recomputed.
5. **Labels in the UI:** estimates read as estimates, and every figure shows what it's compared against.

## Stored formats (schema, migrations, raw stores, serialized outputs)
1. **One migration in flight.** `melon gate` enforces it. If another PR holds it, stop at your checkpoint.
2. **Additive first.** Add a column or table, backfill idempotently, then switch readers. Destructive steps go in a later issue.
3. **Idempotent writes:** a test that runs the same input twice (and in a different order where order could matter) and gets the same rows.
4. **Raw inputs are immutable.** Parsers re-run over stored documents; never edit a stored original.
5. **Restore path:** if the change affects backup or restore, say how the restore drill still passes.

## Auth and access
1. **Default deny.** A new route or reader is behind the guard unless the brief names it public; add a test that a signed-out request is refused.
2. **No new user data or third party** without the owner's decision (`needs-owner`).
3. **Redirects, origins and cookies:** test the hostile case (an open redirect, a cross-site write), not only the happy path.
