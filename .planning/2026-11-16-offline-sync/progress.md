# Progress: Offline queue, sync and conflicts

Plan: docs/superpowers/plans/2026-11-16-offline-sync/README.md. Branch `feat/offline-sync`, worktree `KWNTO-code-offline`.

| Date | Task | Built by | What happened | Review | Escaped | Next |
|---|---|---|---|---|---|---|
| 2026-11-16 | Plan written | - | Router and task files, branched from `feat/editor-core` at 2975e67 | - | - | Task 1 (after Plan 3 is done and the branch is rebased) |
| 2026-11-18 | Plan updated after Plan 3 | - | Merged `main` (d8b50f5: Plan 3, editor tabs and editor cards plans). D11: undo pauses while offline changes wait (Plan 3's `settle` would wait forever), new copy, C13, C14, B3; D13: sign-out question in the page, no `confirm()`; `toNodeId` label `Choice target`; open choices and the card re-mount watch in Task 5's Flow | - | - | Task 1 |
| 2026-11-18 | Task 1 | strong | The outbox model (1A by the controller session itself, not a local model); probes written by the executor; check:task PASS | none | 0 | Task 2 |
| 2026-11-18 | Task 2 | strong | Door: get, shouldRetry/EditConflict, onReconnect; PB_CONNECT confirmed in pocketbase 0.28.2; check:task PASS | none | 0 | Task 3 |
| 2026-11-18 | Task 3 | strong | Sync engine: order, backoff, failed list, conflicts, two tabs; check:task PASS | none | 0 | Task 4 |
| 2026-11-18 | Task 4 | strong | IndexedDB outbox, lifecycle, store through the outbox, status/failed list/conflict dialog, sign-out question; extra e2e for the dialog; bugs found by e2e: stale reload over a newer save, late outbox read, undo before add stored. Flow (ten edits of every kind, by hand) NOT done: e2e covers rename, recolour, line, title conflict, refusal; check:task PASS | none | 0 | Task 5 |
