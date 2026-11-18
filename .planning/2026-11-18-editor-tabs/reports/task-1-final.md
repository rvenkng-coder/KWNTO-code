# Task report: Task 1 (draw.io-style tab bar)

Task file: docs/superpowers/plans/2026-11-18-editor-tabs/task-1-tab-bar.md
Built by: strong (1A, 1B). 2026-11-18.

## What was built

- `menuPosition` (pure, 4 unit tests) and `Popover`: a portal on `document.body`, `position: fixed`, `z-50`, placed by `menuPosition` after measuring itself; closes on Escape (focus back to its button), a press outside, resize and scroll.
- `TabMenu` (▾: Rename, Move left, Move right, Move to trash with the existing confirm; trashing the open chapter shows its neighbour) and `AllChaptersMenu` (≡: every live chapter, the open one `aria-current="true"`, a click reopens and shows).
- `ChapterTabs`: ≡, the scrolling tabs (title is an `InlineText` with `role="tab"`, double-click or Rename edits it), then "+" (`Add chapter`). Only the tabs scroll; ≡ and + stay put.
- `InlineText` gained `editing`, `onEditingChange`, `role` and `selected`. `ChapterList.tsx` is deleted.

## Failing runs first

- Step 1A.2: `menuPosition.test.ts` failed (module missing), then 4/4 passed.
- Step 1B.2: all 12 e2e runs failed. Test 1 failed on `toHaveText` (old menu has no `Chapter menu` label or Rename/Move to trash) before reaching the clipping check, so the clip was reproduced with a throwaway probe on the old code: `Move left` and `Move right` both had `elementFromPoint(...).closest('[role="menuitem"]') === null` at their centres.

## Things to review

1. **E1 refined.** A scroll closes a menu only if its button moved. In Chromium, the scroll that brings a half-hidden ▾ into view fires one frame after the click, so the menu closed at once. Found by the Flow walk; new e2e tests C13 (RED in Chromium, then GREEN) and C14 (a real strip scroll still closes the menu).
2. The empty-canvas text "Open a chapter from the list." now says "Open a chapter from ≡ All chapters." (the list is gone).
3. `editor-chapters.spec.ts`: the last check (no `Chapter 2` in All chapters) gained a guard that `Chapter 1` is visible in the list, so it cannot pass with the list unopened. No assertion was removed.
4. `task-3-closeout.md` line 18 quoted a roadmap link as a live link, which broke `npm run lint` at the plan commit; it now names the target in a code span.

## Breaks

B1, B2 and B3 caught.

## Flow (Test plan)

Walked by a throwaway Playwright script (not by hand), 1000×700 window, five chapters (the strip scrolls), in Chromium and Firefox, in the app's light and dark themes: every item of the menus of the last and first tab was fully in the window and topmost at its centre (0 hidden in 4 runs); Move right, Move left and Rename worked from the menus; two closed tabs reopened from ≡. Screenshots checked by eye: menus sit above the canvas in both themes. The developer's own walk is still to come in Task 3.

## check:task output (`--base 4c27ac2 --built-by strong`)

```
PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: not required by this task's test plan; e2e: passed; container: not required by this task's test plan
PASS hygiene
PASS quality: check:quality: ok
PASS coverage: 14 cases point at tests that exist
PASS breaks: run-breaks: 3 caught
PASS probes: the Test plan names no probe folder (none)
INFO review: Review required: no (built by a strong model; the plan's own per-task review applies); escape rate 0 of 0 local tasks

check:task: PASS
```
