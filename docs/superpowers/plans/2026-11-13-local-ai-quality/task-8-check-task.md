# Task 8: `check:task`, the self-check command

Part of the [Local-AI Quality plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong  
**Depends on:** Tasks 2, 3, 4, 5, 6, 7

**Files:**
- Create: `scripts/check-task.ts`, `scripts/check-task.test.ts`, `scripts/lib/coverage.ts`, `scripts/lib/coverage.test.ts`, `docs/developer/check-task.md`
- Modify: `package.json` (`check:task`), `AGENTS.md` (Commands table and the "Hard rules"/"Never edit a failing test" line pointing at the evidence rule), `docs/testing-strategy.md` (fill in the quality checks list with real names and options), `docs/developer/testing.md`

**Interfaces:**
- Consumes: `parseTaskMeta`, `parseTestPlan`, `TestPlan` (Task 2); `checkHygiene` (Task 3); `filesToCheck` and the ESLint command (Task 4); `runBreaks` (Task 5); `summariseProbeRun` and `run-probes` (Task 6); `needsReview`, `parseProgress`, `escapeRate` (Task 7); `changedFiles` (Task 3).
- Produces, `scripts/lib/coverage.ts`:

```ts
export function coverageProblems(plan: TestPlan, readFile: (path: string) => string | null): string[]
// For every case whose layer is not 'manual': the "path :: title" test must exist: the file is readable and contains the title as a test name (inside test(, it(, test.each( or describe nesting: search for the exact title string in quotes or backticks). One problem per missing case, naming the row id. A 'manual' case must have a Flow section that is not "none".
export function layersNeeded(plan: TestPlan): Set<'unit' | 'rules' | 'e2e' | 'container'>   // from the case table
```

- Produces, `scripts/check-task.ts`:

```ts
export interface StepResult { name: string; ok: boolean; informational?: boolean; lines: string[] }
export interface CheckContext { base: string; taskFile: string; taskNumber: number; builtBy: 'local' | 'strong'; plan: TestPlan; changed: string[]; deadlineMs: number }
export interface Step { name: string; run(ctx: CheckContext): Promise<StepResult> }
export function defaultSteps(): Step[]   // order: plan, lint, typecheck, unit, layers, hygiene, quality, coverage, breaks, probes, review
export async function runCheckTask(ctx: CheckContext, steps: Step[], now?: () => number): Promise<{ ok: boolean; report: string }>
```

Command: `npm run check:task -- --task <task file> [--base <sha>] [--built-by local|strong]`. Defaults: base is `git merge-base HEAD main`; built-by `local`; task number read from the file name `task-<N>-...md`. Rules:
- `plan` step: `checkTaskFile` on the task file; a task file that fails stops nothing else (the other steps still run so the report is complete) but the result is a failure.
- `lint`, `typecheck`, `unit` run `npm run lint`, `npm run typecheck`, `npm run test:unit`. `layers` runs `npm run test:rules`, `npm run test:e2e`, `npm run test:container` only for layers the Test plan names (`layersNeeded`); a layer not named is "not required by this task's test plan", not a pass for something unrun.
- `hygiene`, `quality`, `coverage`, `breaks`, `probes` as in Tasks 3 to 6. `probes` is a failure when the plan names a probe folder that is missing or empty. A task with no probe folder line fails the `plan` step, not here.
- `review`: **informational**, prints `Review required: yes|no (reason)` from `needsReview` with the escape rate read from the plan folder's `.planning/<plan>/progress.md` if present, else 0.
- The whole command has a 10-minute budget (`deadlineMs`): a step that has not started when the budget is used up fails with "not run: time budget used" (never silently skipped), and a running step is killed at the deadline.
- Output: one line per step (`PASS`, `FAIL`, `INFO`), then the detail lines of each failing step (row ids and kinds, never probe inputs), then the verdict line `check:task: PASS` or `check:task: FAIL (n steps)`. Exit 0 only if every non-informational step passed.
- A failing check cannot close a task: `docs/developer/check-task.md` and `AGENTS.md` say the implementer pastes the output into its report and the controller refuses a task with a FAIL or without the paste.

**If interrupted:** a killed run can leave a deliberate break applied (Task 5): run `git status` and `git checkout --` any source file you did not edit.

## Checkpoint 8A: coverage and the runner

- [ ] **Step 1: Write failing tests** `scripts/lib/coverage.test.ts`: `a case whose test title exists in the named file is covered`; `a case whose file does not exist is reported with its row id`; `a case whose title is not in the file is reported`; `a title found only in a comment is reported (the check looks for it as a test name: after test(, it(, test.each( or in a string argument)`; `two cases may point at the same test`; `a manual case needs a Flow that is not none`; `layersNeeded ignores manual and returns the set`; `an empty case list is not covered silently (it is already a plan problem; coverageProblems returns a problem too)`.
- [ ] **Step 2: Write failing tests** `scripts/check-task.test.ts` with fake steps and a fake clock: `all steps passing gives PASS and exit code 0`; `one failing step gives FAIL and names it, and the later steps still run`; `an informational step never fails the run`; `a step that throws is reported as a failure with its message, not a crash`; `when the budget is used up before a step the step fails with "not run: time budget used"`; `the report lists failing row ids and kinds and never a probe input` (a fake probes step returns lines; the runner prints them as given, and the real probes step's lines are tested in Task 6); `a layer not named by the plan is reported as not required, not as passed`; `the task number is read from task-3-x.md and a file name without it is a usage error`; `--built-by with another value is a usage error`; `missing --task prints usage and exits 2`.
- [ ] **Step 3: Run** `npx vitest run --project unit scripts/lib/coverage.test.ts scripts/check-task.test.ts`; FAIL. **Step 4: Implement** `coverage.ts`, then `runCheckTask` with the injected steps and clock. **Step 5: Run**; PASS. **Step 6: Close checkpoint 8A** (commit `feat: check:task runner and plan coverage`).

## Checkpoint 8B: the real steps, and proof

- [ ] **Step 7: Implement `defaultSteps`** (spawn each command with `spawnSync` and no shell; capture output; keep only the last 40 lines of a failing command; kill at the deadline) and the command-line parsing. Add `check:task` to `package.json`.
- [ ] **Step 8: Prove it passes.** In a scratch branch, add a tiny function `scripts/lib/example.ts` with `example.test.ts` (a `// Protects:` header on every test), a Test plan task file in a scratch plan folder (with `**Standard:** test-plan-v1` in its README, a case table pointing at those tests, two breaks, a probe folder with two probe files that pass), commit, and run `npm run check:task -- --task <that file> --base <the commit before>`. Expected: `check:task: PASS`. Paste the output.
- [ ] **Step 9: Prove it fails, naming the row, for each kind of miss.** On the same scratch branch make each change in turn (undo it after) and paste the report line that names it: delete a test header; add `it.skip`; make a function 60 lines long; point a case row at a title that does not exist; weaken the tests so a break survives; make a probe fail (its input must not appear in the report); name a probe folder that does not exist. Then delete the scratch branch and folder.
- [ ] **Step 10: Documentation.** `docs/developer/check-task.md`: the command, each step and what it proves, the 10-minute budget, how to read a FAIL, what to do after an interrupted run. Fill in `docs/testing-strategy.md` section 6 with the real step names. Update `AGENTS.md` Commands and the sentence about evidence. Commit `feat: check:task`.
- [ ] **Step 11: Verify** `npm test` green (the whole suite), `npm run check:docs` clean. **Step 12: Close checkpoint 8B.**

## Test plan

Builds the checks. The proof in Steps 8 and 9 is the acceptance test of the whole plan: every kind of miss in Review Focus is shown to produce a FAIL naming it.
