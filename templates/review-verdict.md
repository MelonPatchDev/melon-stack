REVIEW VERDICT: <APPROVE|CHANGES> @ <head sha>

Plan coverage:
- T1 ✓ `path/to/test.ts:42`
- T2 ✗ missing / asserts a weaker behaviour (`file:line`)

Safe because (H only):
- <the one fact the change is safe because of> · level <1–5: asserted, cited, walked, ran, reproduced> · proof: <command + output line>, or "unproven"

Unnamed system change (for the orchestrator to decide):
- <diff lines> · the System line it needs, or "none"

Blocking (each with proof):
- <finding> · proof: <failing command + output line> or <quoted spec / ground-rule line>

Notes (non-blocking):
- <note>, or "none"

[reviewer #<issue>]
