# Task report: Task 2 (Add node button)

Task file: docs/superpowers/plans/2026-11-18-editor-tabs/task-2-add-node.md
Built by: strong (2A, 2B). 2026-11-18.

## What was built

- `canvas/newNode.ts`: `newNodeRecord` and `freeSpot` (4 unit tests). `createAt` (double-click) now builds its record with `newNodeRecord`; behaviour unchanged.
- `canvas/canvasCommands.ts` (Zustand store with `addNode`) and `canvas/useAddNode.ts`: while a canvas is shown it registers a command that takes the centre of the canvas, converts it to flow coordinates, steps past taken spots, creates the node and selects it.
- `EditorScreen` left panel: `+ Add node` (`aria-label="Add node"`, disabled while no canvas is shown) and the hint `or double-click the canvas`.

## Failing runs first

- Step 2A.2: `newNode.test.ts` failed (module missing), then 4/4 passed.
- Step 2B.2: all 6 runs failed (no button, no hint).

## Things to review

1. **A queued first fit moved the view.** With the button in place, two tests still failed (RED): in a chapter that was empty when opened, React Flow's `fitView` stays queued until the first node exists, then fits and centres that node. The node was half a card (112, 22) from the centre, and a second click was offset (112, 22) instead of (40, 40). `useAddNode` now cancels the queue (`store.setState({ fitViewQueued: false })`, a field of React Flow's typed store) before creating the node. This depends on one React Flow store field (version 12.12.1); if a later version renames it, the add-node e2e tests fail.
2. **Not done: dropping `fitView` for empty chapters.** I tried it first and reverted it. `e2e/editor-panel.spec.ts` "cues and connection labels are saved" lays out its nodes assuming the first double-clicked node gets centred by that fit, and it timed out (4 of 4 runs in Chromium) when the fit stopped. A failing test is not edited, so the double-click path keeps its behaviour. The consequence: double-clicking an empty chapter still moves the view to centre the first node; only the button avoids it.
3. Not checked on a chapter with nodes that is panned or zoomed far from them: the Flow walk panned and zoomed an empty canvas, so it shows the node at the visible centre and the 40 px step, but not a view away from existing nodes.

## Breaks

B1 and B2 caught.

## Flow (Test plan)

Walked by a throwaway Playwright script (not by hand), in Chromium and Firefox: wheel zoom and a drag on the empty canvas, then `+ Add node` twice. The first card's top-left was at the canvas centre (376, 247 in a 750×496 canvas), the second was offset (40, 40) in flow coordinates, and the properties panel was open. The developer's own walk is still to come in Task 3.

## check:task output (`--base eeaf621 --built-by strong`)

```
PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: not required by this task's test plan; e2e: passed; container: not required by this task's test plan
PASS hygiene
PASS quality: check:quality: ok
PASS coverage: 7 cases point at tests that exist
PASS breaks: run-breaks: 2 caught
PASS probes: the Test plan names no probe folder (none)
INFO review: Review required: no (built by a strong model; the plan's own per-task review applies); escape rate 0 of 0 local tasks

check:task: PASS
```
