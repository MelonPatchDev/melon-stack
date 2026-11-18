# Example product ground rules

melon-stack's playbooks hold only process that applies to every repo. Rules about one product go in that repo's `CLAUDE.md`, where the reasoning order reads them first. These are the kind the project melon-stack grew out of (a numbers-heavy app built on ingested documents) kept there. Copy the ones that fit, in your own words, and delete the rest.

## Numbers
- Numbers render through the shared formatting components, never ad hoc.
- Estimates read as estimates in the UI, and every figure shows what it's compared against.
- "No value" is never shown as 0.
- If stored results change, bump the results version and say how existing rows are recomputed.

## Data
- Raw inputs are immutable: parsers re-run over stored documents; never edit a stored original.
- Every stored figure traces back to the document and line it came from.
- A change that affects backup or restore says how the restore drill still passes.

## Outside services
- Fetch politely: identify the client, respect rate limits and robots rules, cache what you can.
- No new third party or new user data without the owner's decision.
