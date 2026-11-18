# Decision log

<!-- The body of the decision-log record (by default a GitHub issue labelled `decisions`). Any role adds an entry with `melon decision add`, which picks the next D<n> and re-reads the log after writing; don't add rows by hand. It keeps a `melon:next-decision` comment so ids never repeat after entries graduate.
It holds OPEN decisions only: ones made for work that isn't finished. The last column must name the work item(s) as #n: `melon gate` holds a PR that closes one until it lists "D<n> → <where>", and `melon merge` removes the row. When the work merges, each decision graduates into the codebase (a test, a type, a lint or gate rule, a ground rule, or a line in a reference doc such as the glossary) and its entry is removed. The reasoning stays on the issue or PR where it was argued; the code and tests are the record of what was built. -->

| # | Decision | Basis | Argued in | Graduates to | For |
|---|---|---|---|---|---|
| D1 | <one line: what was decided> | <ground rule / persona / criterion / precedent / taste call> | #<issue or PR> | <test, type, lint, ground rule, reference doc, or "nothing: the code makes it obvious"> | #<work item> |
