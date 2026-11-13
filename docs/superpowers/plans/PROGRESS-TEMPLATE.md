# Progress template

Copy this table into `.planning/<date>-<plan>/progress.md` and add one row per checkpoint. The three columns **Built by**, **Review** and **Escaped** are read by `npm run report:escape-rate -- <progress.md>`; see [review sampling](../../developer/review-sampling.md).

- **Built by:** `local` or `strong`.
- **Review:** `none`, `clean` or `found N`.
- **Escaped:** a whole number, the problems found after the task was closed; `0` if none. Text such as `1x` or an empty cell is rejected.

| Date | Task | Built by | What happened | Review | Escaped | Next |
|---|---|---|---|---|---|---|
