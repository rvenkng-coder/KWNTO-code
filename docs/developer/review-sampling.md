# Review sampling and escape rate

A task built by a local model gets a review at close only when the rule below says so. The rule lives in `scripts/review-sample.ts` (`needsReview`); the measure that tunes it lives in `scripts/escape-rate.ts`.

## The rule

1. **Built by a strong model:** not required. The plan's own per-task review applies.
2. **Built by a local model, always reviewed:**
   - any changed file under `backend/pb_migrations/`, `backend/pb_hooks/`, `tests/rules/` or `src/backend/`, or any path containing `sync`, `conflict` or `queue` (case does not matter, backslashes are read as `/`). The reason names the file. These are the paths where a silent mistake costs most (design 6.5: access rules, data shape, the one door to the backend, offline sync).
   - the escape rate is above 0.25 (every local task is reviewed), or is not a number in [0, 1] (fail closed).
3. **Otherwise** every third task (`taskNumber % 3 === 0`) is reviewed, so ordinary work is sampled at 1 in 3. A task number that is 0, negative or not a whole number is never sampled.

## The columns

Rows in `progress.md` for tasks built by a local model carry three columns (template: `docs/superpowers/plans/PROGRESS-TEMPLATE.md`):

- **Built by:** `local` or `strong`.
- **Review:** `none`, `clean` or `found N`, from a sampled or always-review at close.
- **Escaped:** the number of problems found **after** the task was closed (by a later review, the developer or a failing later task); 0 if none.

## The escape rate

`npm run report:escape-rate -- <progress.md>` prints `escape rate: 1 of 4 local tasks (25%)`: among rows built by `local`, the share with Escaped above 0. It exits 1, and does not print a percentage, when the file is missing or empty, has no table with the three columns, or has a row whose Escaped cell is not a whole number or whose Built by is neither `local` nor `strong`. A rate above 25% makes every local task reviewed (rule 2), so a bad run tightens review until it recovers.

## What a reviewer checks

- The diff, against the task's Test plan and the standards (`docs/engineering.md`), never the model's own summary of what it did.
- A reviewed task records what was found in its Review cell (`found N`, or `clean`), so the rate can be measured. Problems that turn up later go in Escaped.
