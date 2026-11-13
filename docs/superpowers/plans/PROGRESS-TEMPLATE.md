# Progress template

Copy this table into `.planning/<date>-<plan>/progress.md` and add one row per checkpoint. The three columns **Built by**, **Review** and **Escaped** are read by `npm run report:escape-rate -- <progress.md>`; see [review sampling](../../developer/review-sampling.md).

- **Built by:** `local` or `strong`; `-` marks a row that is not a task (for example "Plan written"), which is not counted and needs no Review or Escaped.
- **Review:** `none`, `clean` or `found N`.
- **Escaped:** a whole number, the problems found after the task was closed; `0` if none. Text such as `1x` or an empty cell is rejected on task rows. Keep the table in one block: a blank line between rows is an error.

| Date | Task | Built by | What happened | Review | Escaped | Next |
|---|---|---|---|---|---|---|
