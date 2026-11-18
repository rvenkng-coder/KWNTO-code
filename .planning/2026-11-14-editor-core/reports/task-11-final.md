# Task report: Task 11 (properties panel)

Task file: docs/superpowers/plans/2026-11-14-editor-core/task-11-properties-panel.md
Built by: strong (11B, 11C), local (11A, see [task-11-11A.md](task-11-11A.md)). Graded 2026-11-16.

## What was built

- `store/pendingEdits.ts` (800 ms per field, flush, flushAll, leave warning) and `store/useSavedText.ts`.
- The panel (`panel/`): title, 8 colour swatches, **Make start node**, script lines (character with a `<datalist>` of `characterSuggestions`, text, Enter and Backspace, Move up and down, Delete), cues, connection label and Delete connection, several nodes with Move to trash. `panel/ordering.ts` (unit-tested) turns a sort-order placement into the writes.
- `EditorScreen` flushes waiting text on selection, chapter and project change, unmount and `pagehide`, and warns on `beforeunload` while anything is unsent.

## Things to review

1. **Make start node moved** from the canvas toolbar into the panel (the spec puts it in the panel; two buttons with one name would be ambiguous). User docs updated.
2. **C9 passes on the blur flush alone.** Clicking another node or a tab blurs the field, which saves it, so with the move-on flushes removed C9 still passed; with every flush path removed (blur, unmount, move-on) it failed (no PATCH within 500 ms). The move-on flushes are a second line, and the only one for a page reload.
3. C9 waits 500 ms for the PATCH; under heavy load (load average 26) it failed once in Chromium. On a quiet machine it passes. Not changed (never edit a failing test).
4. `useSavedText` takes a teammate's value while nothing of ours is waiting for that field, not only while the field is unfocused (the Interfaces line says "not focused").
5. 11C closed in two commits (3cefd2a without C10, ba5d9f6 with it) because C10 needed 11A from the local run.

## Breaks

B1 and B2 caught (`check:breaks`, inside `check:task`).

## Flow (Test plan)

Not walked by hand in either browser. The e2e tests cover most of it (C7 to C11); typing and reloading at once with the leave warning was not tried by hand.

## check:task output (`--base c06b2e4 --built-by strong`)

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
INFO review: Review required: no (built by a strong model; the plan's own per-task review applies); escape rate 4 of 6 local tasks

check:task: PASS
```
