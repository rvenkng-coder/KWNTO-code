# 0003: Canvas performance at 500 nodes

**Date:** 2026-11-16
**Environment:** Linux 6.12 (Debian 13), AMD Ryzen 7 7735HS (16 threads), 22 GB RAM. PocketBase 0.40.6 in Docker (the e2e test backend), Vite dev server (not a production build), `@xyflow/react` 12.12.1, Playwright 1.65.0 with its Chromium and Firefox, default 1280 × 720 viewport. Local loopback, no proxy, one test at a time (`--workers=1`).

## The budget

Plan 3 (Global Constraints): a project with **500 nodes in one chapter and 5,000 lines** shows every node within **3 s** of opening, in both browsers, and a drag saves once.

## Results

`npm run test:e2e -- e2e/editor-performance.spec.ts --repeat-each=3 --workers=1` (since Plan 3 Task 14 the spec has its own projects that run after the rest of the suite, one browser at a time; to run it alone now: `npm run test:e2e -- --project perf-chromium --project perf-firefox --no-deps --repeat-each=3`). The test seeds 500 nodes on a 25 × 20 grid, 10 lines each and 499 connections (a chain), then measures from `page.goto` (a full page load, after `about:blank`) until the canvas says `data-node-count="500"` and `data-ready="true"` and a card is visible. Then it drags one node and counts `PATCH` requests to `nodes`.

| Run | Chromium | Firefox |
|---|---|---|
| 1 | 650 ms | 1,055 ms |
| 2 | 687 ms | 1,063 ms |
| 3 | 659 ms | 1,076 ms |
| PATCH per drag | 1 (each run) | 1 (each run) |

Every load is under the 3,000 ms budget, Firefox with about 1.9 s to spare. Earlier single runs during development were 758 to 1,378 ms.

`data-ready` turns `true` once React Flow has initialised and its node list matches the store. It does not wait for every node to be measured: with `onlyRenderVisibleElements`, nodes outside the view are never drawn, so React Flow's `useNodesInitialized` would never become true.

## What was optimised and why

Each is marked with a `PERF:` comment in the code.

| Where | What | Why | Trade-off |
|---|---|---|---|
| `model/flow.ts` | Lines and cross-chapter links grouped by node in one pass | Asking per node walks all 5,000 lines 500 times on every change | Two maps built on every call, even for small chapters |
| `canvas/Canvas.tsx` | `nodeTypes` defined once, outside the component | A new object each render re-mounts every node | None |
| `canvas/Canvas.tsx` | An unchanged node keeps its object and its `data` object when merging the store into React Flow's state | The memoised card then skips re-rendering, so one edit re-renders one card | A JSON comparison of each card's small data per content change |
| `canvas/Canvas.tsx` | `onlyRenderVisibleElements` | Only the cards in view are in the DOM (about 40 of 500 at the opening zoom) | Cards appear a frame late while panning fast |
| `canvas/NodeCard.tsx` | `memo` on the card | A change to one node re-renders only that card | A card that must change needs a new `data` object (the merge gives it one) |

Positions live in React Flow's local state while a node is dragged and are written to the store and the server once, in `onNodeDragStop`. That is what keeps a drag to one `PATCH`.

## Not measured

- A production build (`vite build`) at the time of this decision; the dev server is slower, so these numbers are an upper bound. **Since 2026-11-18** the spec runs against a production build (`vite preview`), after the dev server took 3.9 s in Firefox on a GitHub runner (developer decision).
- A slower machine, and panning smoothness as a number (the Task 10 Flow records how panning felt).
- The time to open over Tailscale Funnel (decision 0002 measured the data load there: well under budget).

## Decision

Keep React Flow with the settings above. No further optimisation now. Re-run this test when the card grows (Task 11 adds nothing to the card; Task 13 adds clickable tags) and if a production report says otherwise.
