# Task report: Task 10 (the canvas)

Task file: docs/superpowers/plans/2026-11-14-editor-core/task-10-canvas.md
Built by: strong (one session, base `67e9d11`), checkpoints 10A to 10D. 10A is planned as local; it was built by the strong session because the developer asked this session to implement Task 10.

## What was built

- **Probes first** (1e061cc): 7 probes for C1 to C7 in `tests/probes/2026-11-14-editor-core/task-10/`, written from the Test plan and the catalogue by the same session that then built the task, so they are not sealed.
- **10A** (de0e305): `markers.test.ts` (C1 to C4) failed first (module not found), then `markers.ts`.
- **10B** (2975e67): `flow.test.ts` (C5 to C7) failed first (module not found), then `flow.ts`, `colors.ts`, `useSelection.ts`, `NodeCard`, `CanvasToolbar`, `Canvas`, React Flow theme variables in `index.css`, canvas in `EditorScreen`.
- **10C** (0c3f110): e2e C8 to C11, helpers `addNodeAt`, `connectNodes`, `nodePosition`; `docs/user/editor.md` "Nodes and connections".
- **10D** (ef1bc5b, then a hygiene fix): `e2e/helpers/seed.ts`, `e2e/editor-performance.spec.ts` (C12), decision 0003, the canvas section of `docs/developer/editor.md`, link in `docs/README.md`.

## Things to review

1. **The e2e tests C8 to C11 were written after the canvas code** (the plan puts 10B before 10C), so they could not fail for a missing feature. Their first run did fail, for a real bug: the canvas column overflowed under the right panel, so double-clicks landed on the panel (fixed with `min-w-0` on the canvas section). To show they guard something I applied two deliberate breaks by hand, Chromium only: saving positions in `onNodeDrag` made C9 fail (19 PATCHes instead of 1); ignoring the saved minimap choice made C11 fail. Both restored.
2. **The canvas is about 500 px wide** because `AppShell` caps the page at `max-w-5xl` (1024 px) and the side panels take 30 rem. Usable, but cramped; a full-width editor layout is a decision for the developer (not changed here).
3. **Trash does not let React Flow delete edges.** `onBeforeDelete` makes the edits itself and returns `false`; otherwise React Flow would also delete the connections of a trashed node from the server. Only a connection that is itself selected is removed.
4. **`data-ready`** means React Flow is initialised and its node list matches the store, not that every node is measured: with `onlyRenderVisibleElements` off-screen nodes are never measured, so `useNodesInitialized` would never be true. The performance test also waits for a visible card.
5. **The no-start note** shows only when the project has at least one live node (an empty new project does not nag; its first node becomes the start).
6. **Preview cut:** a line longer than 80 characters becomes 79 characters plus `…` (80 in total). The Test plan says "cut to 80 with `…`"; I read it as 80 in total.
7. **`NodeCardData` extends `Record<string, unknown>`**, which React Flow 12 needs for node data; the fields are as in the Interfaces block. `flow.ts` also exports `CardNode` (`Node<NodeCardData, 'card'>`).
8. **Hygiene false positive:** `check:hygiene` counted `test.setTimeout(...)` and `test.info()` as new tests without a header. The spec now uses the `testInfo` fixture argument instead. The checker could learn to ignore `test.<method>` calls that are not tests (follow-up, not done).
9. `adminPB` in `e2e/helpers/admin.ts` is now exported (the seed helper uses it).

## Breaks

`npm run check:breaks -- docs/superpowers/plans/2026-11-14-editor-core/task-10-canvas.md`:

```
B1 caught
B2 caught
B3 caught
run-breaks: 3 caught
```

Before the full runner existed for B3, B1 and B2 were also applied by hand to `markers.ts`: each made 1 of the 4 marker tests fail.

## Performance (10D)

`npm run test:e2e -- e2e/editor-performance.spec.ts --repeat-each=3 --workers=1` (Ryzen 7 7735HS, dev server, PocketBase in Docker):

| Run | Chromium | Firefox |
|---|---|---|
| 1 | 650 ms | 1,055 ms |
| 2 | 687 ms | 1,063 ms |
| 3 | 659 ms | 1,076 ms |

Budget 3,000 ms; exactly 1 PATCH per drag in every run. The first run of the spec failed on the drag (it grabbed the first card in the DOM, which was only partly inside the canvas); the test now picks a card wholly inside the canvas. Details in [decision 0003](../../../docs/decisions/0003-canvas-performance.md).

## Flow (Test plan)

**Not walked by hand** in this session (no interactive browser). Covered by e2e in Chromium and Firefox: create nodes, connect, reload (C8); drag and one PATCH (C9); markers, trash the start node, the note, no edge, no error banner (C10); the minimap choice across a reload (C11); the 500-node project opens and a node drags (C12). **Not exercised:** ten nodes at once, box selection and dragging several nodes, "Make start node", light versus dark look of the canvas, and how panning the 500-node project feels. The developer should walk these and record them in `progress.md`.

## Other layers

`npm run test:rules` (184 passed) and `npm run test:container` (5 passed), not named by this Test plan, were also run and pass.

## check:task output

```
> kwnto@0.0.0 check:task
> node scripts/check-task.ts --task docs/superpowers/plans/2026-11-14-editor-core/task-10-canvas.md --base 67e9d11 --built-by strong

PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: not required by this task's test plan; e2e: passed; container: not required by this task's test plan
PASS hygiene
PASS quality: check:quality: ok
PASS coverage: 12 cases point at tests that exist
PASS breaks: run-breaks: 3 caught
PASS probes: probes: 7 of 7 passed
INFO review: Review required: no (built by a strong model; the plan's own per-task review applies); escape rate 4 of 5 local tasks

check:task: PASS
```
(The first run failed `hygiene` only, for the `test.setTimeout` / `test.info()` false positive in item 8.)
