# Task 7: Review sampling and escape rate

Part of the [Local-AI Quality plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid  
**Depends on:** none

**Files:**
- Create: `scripts/review-sample.ts`, `scripts/review-sample.test.ts`, `scripts/escape-rate.ts`, `scripts/escape-rate.test.ts`, `docs/developer/review-sampling.md`
- Modify: `AGENTS.md` (Tracking and resuming: the two progress columns), `docs/developer/testing.md` (link), `package.json` (`report:escape-rate`)

**Interfaces:**
- Produces, `scripts/review-sample.ts`:

```ts
export const SENSITIVE: RegExp[]   // paths that always need a strong review (design 6.5): backend/pb_migrations/, backend/pb_hooks/, tests/rules/, frontend/src/backend/, and any path containing "sync", "conflict" or "queue"
export interface ReviewInput { changedFiles: string[]; taskNumber: number; builtBy: 'local' | 'strong'; escapeRate: number }  // escapeRate in [0, 1]
export function needsReview(input: ReviewInput): { required: boolean; reason: string }
```

Rules **[my call]**: `strong` built: not required, reason "built by a strong model; the plan's own per-task review applies". Local built: required if any changed file matches `SENSITIVE` (reason names the file); else required if `escapeRate > 0.25` (every task); else required if `taskNumber % 3 === 0`; else not required with reason "not in the sample (1 in 3)".

- Produces, `scripts/escape-rate.ts`:

```ts
export interface ProgressRow { task: string; builtBy: 'local' | 'strong' | ''; review: string; escaped: number }
export function parseProgress(markdown: string): { rows: ProgressRow[]; problems: string[] }   // reads a markdown table whose header has "Built by", "Review" and "Escaped" columns
export function escapeRate(rows: ProgressRow[]): { rate: number; localTasks: number; escapedTasks: number }
```

`escapeRate`: among rows built by `local`, the share with `escaped > 0`; 0 when there are no local rows. Command: `node scripts/escape-rate.ts <progress.md>` prints `escape rate: 1 of 4 local tasks (25%)`; exit 1 with a message if the file has no table with those columns (a progress file that does not track them cannot be measured; fail, do not print 0%).
- Column meanings (written into `docs/developer/review-sampling.md` and the `AGENTS.md` tracking text): **Built by** `local` or `strong`; **Review** `none`, `clean` or `found N` (a sampled or always review at close); **Escaped** the number of problems found **after** the task was closed (by a later review, the developer or a failing later task), 0 if none.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 7A: `needsReview`

- [ ] **Step 1: Write failing tests** `scripts/review-sample.test.ts`: `a strong-built task is not sampled`; `a local task touching backend/pb_hooks/x.js is always reviewed and the reason names the file`; `a local task touching tests/rules/, backend/pb_migrations/, frontend/src/backend/ is always reviewed`; `a path containing sync, conflict or queue is sensitive`; `case does not matter in that path match (Sync, QUEUE)`; `a local task with only frontend/src/features files is reviewed when taskNumber is 3 and 6 and not 1, 2, 4`; `taskNumber 0 and negative do not crash and are not sampled`; `escapeRate above 0.25 reviews every local task`; `escapeRate exactly 0.25 does not`; `an empty changedFiles list is handled (reason says nothing changed)`; `windows-style backslash paths are normalised before matching`.
- [ ] **Step 2: Run** `npx vitest run --project unit scripts/review-sample.test.ts`; FAIL. **Step 3: Implement.** **Step 4: Run**; PASS. **Step 5: Close checkpoint 7A** (commit `feat: review sampling rule`).

## Checkpoint 7B: escape rate and docs

- [ ] **Step 6: Write failing tests** `scripts/escape-rate.test.ts`: `parseProgress reads the three columns from a table with other columns around them`; `a table without the columns gives a problem`; `a row with a non-numeric Escaped cell is a problem, not 0`; `escapeRate counts only local tasks`; `no local tasks gives rate 0 with localTasks 0`; `the command exits 1 for a file with no matching table and prints why`; `the command prints the share and exits 0 otherwise`; `empty file gives a problem`.
- [ ] **Step 7: Run**; FAIL. **Step 8: Implement.** **Step 9: Run**; PASS.
- [ ] **Step 10: Docs.** Write `docs/developer/review-sampling.md` (the rule, the reason for each part, the three column meanings, how the rate moves the sample, what a reviewer checks: the diff against the Test plan and the standards, never the model's own summary, and that a reviewed task records what was found). Update the `AGENTS.md` tracking line to say `progress.md` rows carry the three columns for tasks built by a local model. Do not edit an existing plan's `progress.md`; Plans after this one start with the columns in their template (the `TASK-TEMPLATE` from Task 2 or a `PROGRESS-TEMPLATE.md` next to it; create that file here with the table header `| Date | Task | Built by | What happened | Review | Escaped | Next |`).
- [ ] **Step 11: Verify** `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run check:docs`. Commit `feat: escape rate and review sampling docs`. **Step 12: Close checkpoint 7B.**

## Test plan

Builds the checks. The always-review paths and the fail-closed progress parse are the two decisions to look at in review.
