# Task report: Task 11, checkpoint 11A (character suggestions)

Task file: docs/superpowers/plans/2026-11-14-editor-core/task-11-properties-panel.md
Built by: local (little-coder, sandbox `/tmp/kwnto-local-2026-11-14-editor-core-task11-11A-20261116T011502Z`, baseline `1c5f1bc`), no fix round
Controller: strong model session, graded 2026-11-16. The run was started from the controller's shell at the developer's request.

## Commits on `feat/editor-core`

| Commit | What |
|---|---|
| 5547a31 | `feat: character name suggestions` (characters.ts, characters.test.ts), from the sandbox with `git am --3way` |
| 79fea63 | `test: tie order of character suggestions with unsorted input`, by the controller |
| aea8016 | `test: probes for task 11 checkpoint 11A`: 6 probes, rows C1 to C3, written by the controller **before** the run and kept out of the sandbox (sealed) |

## Grading notes

- Start: the first load of the `coder` model hit llama-swap's 2-minute health check (`starting coder failed: health check timed out after 2m0s`, a 500 to the first request, no session file after 90 s, GPU 0 %). The `llama` process held 14 GB of the machine's 22 GB while loading; the second load passed and the run went on by itself.
- Changed files: only the two in "May touch"; signature and `SUGGESTION_LIMIT` unchanged. An untracked `.pi/tasks/*.json` (the harness's task list) was not applied.
- Session log: SKILL.md read first; the tests were written first and failed for the right reason (`Cannot find module './characters'`); 32 tool calls; `tests/probes` mentioned only in the prompt, the skill, the plan file, `vitest.config.ts` and `check:task` output, never read.
- Probes: 6 of 6 against the sandbox code.
- Review found 1 (a test gap, not a bug): the C3 test's twelve names are already in alphabetical order, so with the tie-break replaced by `return 0` the model's 3 tests still pass; only the probe `[C3] relative-of-fixed-case` failed. The controller added a test with reversed input in a separate commit; it fails on that mutation.
- The model's own `check:task` failed e2e in Firefox (`join by code`, `only the owner can move a project to the trash`) while the model held the CPU; the controller's runs below pass.
- Escaped: 0 (no bug in the code).

## `check:task` output (real checkout, `--base 1ff9390 --built-by local`, on a quiet machine)

The first try of this command (load average 26, the 12A run on the CPU) failed e2e: 11 Firefox timeouts opening a project and C9 in Chromium. Rerun unchanged once the machine was quiet:

```
PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: not required by this task's test plan; e2e: passed; container: not required by this task's test plan
PASS hygiene
PASS quality: check:quality: ok
PASS coverage: 11 cases point at tests that exist
PASS breaks: run-breaks: 2 caught
PASS probes: probes: 6 of 6 passed
INFO review: Review required: yes (escape rate 0.6666666666666666 is above 0.25; every local task is reviewed); escape rate 4 of 6 local tasks

check:task: PASS
```

## Not recorded here

The Flow walk of the Test plan (both browsers by hand) was not done; see `task-11-final.md`.
