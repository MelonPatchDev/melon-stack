# Maintenance batch

**Several small fixes in one session, so the onboarding cost is paid once.** The issue was made by `melon batch --create` and lists its items.

1. Read the batch issue and each linked item, then group the items by the files they touch.
2. **One commit per item** (`fix: <what> (#<item>)`). Each comes with a test that would have caught it, or one line on the PR saying why a test isn't practical (docs wording, for example).
3. Keep each fix to its root cause. If an item turns out to be bigger than S (it needs a contract change, touches a hotspot or changes a number), **drop it from the batch**: comment on the item, remove its `batched` label, and tell the orchestrator. Don't let the batch grow into a feature.
4. One PR closes every item that was fixed (`Closes #a, #b, #c`). Run `melon check --record <pr>`, then `melon gate <pr>`.
5. **Impact:** `**Idea:**` summarises the batch in one sentence (it becomes the daily-log line) and `**System:**` names anything beyond the items' files, or "none". The per-item lines go under Acceptance criteria: one per item, with its test or the reason it has none.
