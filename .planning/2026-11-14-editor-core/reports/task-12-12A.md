# Task report: Task 12, checkpoint 12A (shortcuts)

Task file: docs/superpowers/plans/2026-11-14-editor-core/task-12-undo-copy-shortcuts.md
Built by: local (little-coder, sandbox `/tmp/kwnto-local-2026-11-14-editor-core-task12-12A-20261116T011508Z`, baseline `442cd27`), then one fix round
Controller: strong model session, graded 2026-11-16. Runs started from the controller's shell at the developer's request.

## Commits on `feat/editor-core`

| Commit | What |
|---|---|
| 969a385 | `feat: editor shortcuts` (shortcuts.ts, shortcuts.test.ts), from the sandbox with `git am --3way` |
| ad22841 | `fix: alt and the text-field rule in shortcuts` (fix round 1), same way |
| aff4a4f | `test: probes for task 12 checkpoint 12A`: 5 probes, rows C1 to C3, written by the controller before the run and kept out of the sandbox (sealed) |

## Grading notes

- Round 1: only the two allowed files; types and signature kept. SKILL.md read first; tests first (`Cannot find module './shortcuts'`); 75 tool calls; no read of `tests/probes/`. It edited its own new tests several times after writing the code (before its commit).
- Review found 2:
  1. **Bug:** `shortcutFor` checked the text field before Alt, so Alt+Ctrl/⌘+K inside a text field returned `search` (the Interfaces block: "Alt held -> null"). The sealed probe `FAIL C3 (second-bad-item)`, 4 of 5. Counted as Escaped 1.
  2. **Step 3 not followed:** the line `if (inTextField) return action === 'search' ? action : null` was missing, so break B1 could not be applied. The model's report said the breaks FAIL was about later checkpoints.
- Fix round 1 (`PROMPT-fix1.md`, own session dir): a new test failed first (`expected 'search' to be null`), then the fix as a new commit, no amend; 14 tool calls; no probe read. Probes 5 of 5. In the worktree B1 is caught.

## `check:task` output (real checkout, `--base 53d3b99 --built-by local`)

Two earlier tries failed: once on the Firefox 500-node budget (3,080 ms against 3,000 under 4 workers) and the hygiene false positive on `fake.fail`, once on a real undo race (C11 in Firefox, fixed in e005997, see `task-12-final.md`). This is the run after both:

```
PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: not required by this task's test plan; e2e: passed; container: not required by this task's test plan
PASS hygiene
PASS quality: check:quality: ok
PASS coverage: 14 cases point at tests that exist
PASS breaks: run-breaks: 4 caught
PASS probes: probes: 11 of 11 passed
INFO review: Review required: yes (escape rate 0.7142857142857143 is above 0.25; every local task is reviewed); escape rate 5 of 7 local tasks

check:task: PASS
```

## Not recorded here

The Flow walk; see `task-12-final.md`.
