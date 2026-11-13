# `check:task`: the self-check every task ends with

`npm run check:task` runs every check a task must pass, in one command, and prints one verdict. The implementer runs it at the end of a task and pastes the **full output** into its report. It replaces the grading checklist in [local-model-notes.md](local-model-notes.md), so grading no longer depends on a person remembering each check. The layers and the order of the checks are in the [test strategy](../testing-strategy.md), section 6.

## The command

```
npm run check:task -- --task <task file> [--base <sha>] [--built-by local|strong]
```

| Option | Meaning | Default |
|---|---|---|
| `--task` | The task file, named `task-<N>-<name>.md`. The task number `N` is read from the file name (the review sample uses it); a file name without it is a usage error | required |
| `--base` | The commit the task started from. Hygiene, quality and the review sample look only at files changed since this commit | `git merge-base HEAD main` |
| `--built-by` | Who built the task, for the review sample | `local` |

Pass `--base` whenever the branch holds more than this task (a plan branch with several tasks): without it, every file changed on the branch since `main` is checked, and an older task's code can fail a newer one. A value that starts with `-`, an unknown option, an option given twice, a missing `--task` or a `--built-by` other than `local` or `strong` prints the usage and exits 2. A base that is not a commit, or a task file that cannot be read, exits 1 with a message.

The code is `scripts/check-task.ts` (runner, report, arguments), `scripts/lib/check-steps.ts` (the steps), `scripts/lib/coverage.ts` (the coverage step) and `scripts/lib/run-command.ts` (child processes and the deadline).

## The steps, and what each proves

Every step runs, even after an earlier one failed, so the report is complete.

| Step | Runs | Proves |
|---|---|---|
| `plan` | `checkTaskFile` from `check:plan` on the task file | The task file has a tier, an Interfaces line and a complete Test plan block ([format](test-plan-format.md)). A broken plan fails this step; the other steps still run with what could be read |
| `lint` | `npm run lint` | ESLint, `PERF:` comments, documentation links and every opted-in plan |
| `typecheck` | `npm run typecheck` | Strict TypeScript compiles |
| `unit` | `npm run test:unit` | The whole unit layer passes, not only the task's tests |
| `layers` | `npm run test:rules`, `test:e2e`, `test:container`, only for the layers the Test plan's Cases name | Each named layer passes. A layer not named is printed as `not required by this task's test plan`, never as a pass |
| `hygiene` | `checkHygiene` (as `check:hygiene --base <base>`) | New tests have a header comment, nothing is skipped or focused, no test or assertion was lost |
| `quality` | `checkChanged` (as `check:quality --base <base>`) | Files changed since the task's base stay within the [quality limits](quality-limits.md). Older files on the branch are not checked |
| `coverage` | `coverageProblems` | Every non-manual case row's `path :: title` names a test that exists: the file is readable, parses, and has a `test(` or `it(` (any chain, such as `test.each(...)`) with exactly that title. A title only in a comment or a loose string does not count. A `manual` row needs a Flow that is not `none`. An empty case list is a problem |
| `breaks` | `node scripts/run-breaks.ts --cwd <repo> <task file>` | Every deliberate break is caught by its named unit tests, and each file is put back ([details](test-plan-format.md#running-the-breaks)) |
| `probes` | `node scripts/run-probes.ts --cwd <repo> <probe folder>` | The unseen probes pass. A probe folder that is missing or has no probe file fails. A plan whose probe folder is `none` passes this step and says so |
| `review` | `needsReview` with the escape rate of `.planning/<plan folder>/progress.md` | **Informational, never fails.** Prints `Review required: yes` or `no` with the reason ([review sampling](review-sampling.md)) |

The `review` step's escape rate: no progress file, or a progress file without the `Built by`, `Review` and `Escaped` columns, counts as 0, and the line says so. Any other problem with the file (an empty file, a malformed `Escaped` cell, a file that cannot be read) is printed and counts as 1, so every local task is reviewed.

Commands run without a shell, with their output captured. A failing command keeps only its **last 40 lines**. The probe runner prints only the row and the kind of each failing probe, so the report never shows a probe's input or expected value.

## The 10-minute budget

The whole command has 10 minutes (600000 ms). A step that has not started when the time is used up fails with `not run: time budget used`; it is never silently skipped. A command still running at the deadline is stopped with its whole process group (SIGTERM, then SIGKILL after 5 seconds) and its step fails with `killed: time budget used`. A run that hits the budget is a FAIL: make the slow step faster or split the task.

## Reading the report

```
PASS plan
PASS lint
...
FAIL breaks
PASS probes: probes: 2 of 2 passed
INFO review: Review required: no (not in the sample (1 in 3)); no .planning/<plan>/progress.md; escape rate 0

FAIL breaks:
  exit code 1
  B1 SURVIVED: the tests did not notice scripts/lib/example.ts: age >= 18 -> age > 18
  B2 caught
  run-breaks: 1 of 2 breaks not caught

check:task: FAIL (1 steps)
```

- One line per step: `PASS`, `FAIL` or `INFO` (informational). A passing step may add a short note after a colon.
- Then, for each failing step, its detail lines: a row id and what is wrong (`C2: no test titled ...`, `B1 SURVIVED ...`, `FAIL C2 (boundary)`), or the last lines of the failing command.
- The last line is the verdict: `check:task: PASS`, or `check:task: FAIL (n steps)` with the number of failing steps. The exit code is 0 only when every non-informational step passed.

What to do with a FAIL: fix the code, or add the missing test, and run the command again. **Never edit a failing test to make it pass** ([engineering.md](../engineering.md) section 3); if a test looks wrong, stop and say so in the report.

## A failing check cannot close a task

The implementer pastes the full output of `npm run check:task` into its report. The controller refuses to close a task whose pasted output has a `FAIL` verdict, and refuses a report without the paste. `Review required: yes` does not fail the check; it tells the controller to review the task before closing it.

## After an interrupted run

Ctrl-C (SIGINT) or SIGTERM stops every command `check:task` started (the break runner puts its file back when it is stopped this way) and exits 130 or 143 with a reminder. If the run was killed hard (SIGKILL, power loss) while a break was applied, a deliberate break can be left in a source file:

1. Run `git status`.
2. A file under `src/`, `scripts/` or `backend/pb_hooks/lib/` that you did not edit is a left-over break: `git checkout -- <file>` puts it back. Do this only for files you did not edit.
3. Run `npm run check:task` again.
