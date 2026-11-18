# Task report: Task 13 (search and cross-chapter links)

Task file: docs/superpowers/plans/2026-11-14-editor-core/task-13-search-cross-links.md
Built by: strong (13B), local (13A, see [task-13-13A.md](task-13-13A.md)). Graded 2026-11-16.

## What was built

- Header search (`SearchBox`, Ctrl/⌘+K, arrow keys, Enter, Escape) in the top bar's slot while a project is open; `NodePicker` ("Link to another chapter") over the other chapters; the panel lists a node's cross-chapter links with Remove; tags on cards are buttons that jump; `jumpToNode` and `useCanvasFocus`.

## Things to review

1. **The canvas selection changed (Task 10 code).** It now comes only from React Flow's `select` changes (`canvas/selectionChanges.ts`, unit-tested), not `onSelectionChange`. `onSelectionChange` reports the canvas's own pushes one update late, so a selection set from outside (a jump) flipped between two values until React stopped with "Maximum update depth exceeded" (found with logging). A select change also drops ids not on the canvas shown: after a tab switch a node of the old chapter stayed selected, and a click then selected two.
2. **The target canvas selects the jumped-to node**, not `jumpToNode`, for the same reason.
3. **Firefox 500-node budget.** This run passed; the run before failed at 3,069 ms. Measured: alone 1,138 to 1,169 ms now against 1,085 to 1,115 ms at c06b2e4 (about 4 %, the focus hook makes no difference); in the full parallel suite 2,519 ms now against 2,253 ms at c06b2e4. The 3 s budget is tight when the test shares the machine with three other workers; a decision for the developer (run the performance spec alone, or with one worker). The test is unchanged.
4. Escape closes the search list; a blur clears the query.

## Breaks

B1 and B2 caught.

## Flow (Test plan)

Not walked by hand (three chapters, accents, keyboard only, tags both ways).

## check:task output (`--base ba5d9f6 --built-by strong`)

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
PASS probes: probes: 6 of 6 passed
INFO review: Review required: no (built by a strong model; the plan's own per-task review applies); escape rate 5 of 8 local tasks

check:task: PASS
```
