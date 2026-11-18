# Task report: Task 12 (undo/redo, copy/paste, shortcuts)

Task file: docs/superpowers/plans/2026-11-14-editor-core/task-12-undo-copy-shortcuts.md
Built by: strong (12B, 12C), local (12A, see [task-12-12A.md](task-12-12A.md)). Graded 2026-11-16.

## What was built

- `model/history.ts`, `model/clipboard.ts` (12B); `store/edits.ts`: every content change of the canvas, panel, chapters and project name goes through it; groups (multi-node drag, trash selection, paste, inserts that renumber); undo and redo through ordinary guarded updates, a blocked step dropped with its message; `useShortcuts` on `window`; Undo and Redo above the canvas; React Flow's own delete key off; history reset when a project opens and closes.

## Things to review

1. **An edit belongs to the group open when it started**, not when it finished (found while wiring Enter: the text flush finished inside the "Add line" group). Unit test first.
2. **Undo waits for saves still on their way** (e005997). Found by `check:task`: Firefox pressed Ctrl+Z after the rename's PATCH answered but before `edits` recorded it, so undo trashed the node made before. Unit test first; the undo spec then passed 24 of 24 with `--repeat-each 3`.
3. A blocked step is **dropped** (not kept for redo), so "the next undo goes further back" (C10).
4. Records made again by undo (a deleted line) start at version 0, as the server's copy does.
5. **Firefox 500-node budget** (Task 10's C12): 3,080 ms once against 3,000 ms in a full parallel suite (4 workers, model loaded in memory); alone 1,159 and 1,127 ms (Task 10: about 1,060 ms). Worth watching; not changed.
6. `check:test-hygiene` read `fake.fail.next` as Vitest's `.fail`; the property is now `refuse`. Checker follow-up: it matches `.fail` on any object.

## Breaks

B1 to B4 caught. C13 also fails with the drag no longer grouped, and C14 with B3 applied (checked by hand).

## Flow (Test plan)

Not walked by hand (twenty mixed edits, copying into another project, Ctrl+Z inside a field).

## check:task output (`--base 3cefd2a --built-by strong`)

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
INFO review: Review required: no (built by a strong model; the plan's own per-task review applies); escape rate 5 of 7 local tasks

check:task: PASS
```
