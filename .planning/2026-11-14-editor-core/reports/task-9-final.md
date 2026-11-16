# Task report: Task 9 (projects, editor layout and chapters)

Task file: docs/superpowers/plans/2026-11-14-editor-core/task-9-projects-layout-chapters.md
Built by: strong (one session, base `56c9837`), checkpoints 9A and 9B

## What was built

- 9A: `tabsView.ts`, `chapterMoves.ts`, `useTabsView.ts`; unit tests C1 to C4 failed first (modules not found).
- 9B: `ProjectList`, `useProjects`, `EditorScreen`, `ErrorBanner`, `ChapterList`, `ChapterTabs`, `e2e/helpers/editor.ts`, `docs/user/editor.md`. The e2e tests C5 to C10 failed first (no project list); all passed in both browsers once the UI existed.
- `App.tsx` shows `EditorScreen` for the project route; `TeamDetail` shows `ProjectList` and the delete confirm names the project count.

## Things to review (not in the Interfaces block)

1. **Extra files:** `chapters/InlineText.tsx` (double-click-to-edit text, used for chapter titles and the project name) and `chapters/chapterActions.ts` (add, rename, trash, shift: the calls from the screens to the store). Both keep the components inside the quality limits.
2. **`Back to teams` is always in the editor's left panel**, not only in the not-found state, so the editor can be left without the browser's back button (the e2e flows use it).
3. **Confirm text:** `Delete this team and its N projects?` for N >= 2, `... its 1 project?` for one, the old `Delete this team?` for none.
4. **`activeAfterClose` takes the strip before the close** (it includes the tab being closed); documented in its comment and test.
5. **Extra e2e test** `a tab can be resized by dragging its edge` (not a Test plan case) covers the resize part of the Flow, including the 80 px floor.
6. A first full e2e run had 3 Chromium tests time out at the `Sign up` button of a cold dev server (before any editor code ran); the rerun and the `check:task` run passed. Recorded as a cold-start flake, not investigated further.
7. Probes (6, `tests/probes/2026-11-14-editor-core/task-9/`) were written after the code by the same session, so they are not sealed. One probe expectation was wrong (my arithmetic) and was fixed, not the code.

## Flow (Test plan)

Not walked by hand. Covered by e2e in Chromium and Firefox: new project, add a chapter, rename, move left, reload (C6), close and reopen a tab, trash a chapter, reload (C7), resize (extra test). Three chapters at once and a trash of the active tab were not exercised.

## check:task output

```
PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: not required by this task's test plan; e2e: passed; container: not required by this task's test plan
PASS hygiene
PASS quality: check:quality: ok
PASS coverage: 10 cases point at tests that exist
PASS breaks: run-breaks: 1 caught
PASS probes: probes: 6 of 6 passed
INFO review: Review required: no (built by a strong model; the plan's own per-task review applies); escape rate 4 of 5 local tasks

check:task: PASS
```
(`--base 56c9837 --built-by strong`; the first runs failed `quality` for the complexity of `EditorScreen`, fixed by splitting it into hooks and `EditorFrame`.)
