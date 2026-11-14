# Task 9: Projects, editor layout and chapters

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** Tasks 1 and 8

A team's projects on the team screen, and the editor's frame (design 6.6 layout: top bar, left panel of the project's chapters, centre for the canvas, right properties panel) with chapter tabs (design 6.3, decision D10). The canvas and the panel are placeholders until Tasks 10 and 11.

**Files:**
- Create: `frontend/src/features/projects/ProjectList.tsx`, `frontend/src/features/projects/useProjects.ts`, `frontend/src/features/editor/EditorScreen.tsx`, `frontend/src/features/editor/ErrorBanner.tsx`, `frontend/src/features/editor/chapters/ChapterList.tsx`, `frontend/src/features/editor/chapters/ChapterTabs.tsx`, `frontend/src/features/editor/chapters/tabsView.ts`, `frontend/src/features/editor/chapters/tabsView.test.ts`, `frontend/src/features/editor/chapters/useTabsView.ts`, `frontend/src/features/editor/chapters/chapterMoves.ts`, `frontend/src/features/editor/chapters/chapterMoves.test.ts`, `e2e/helpers/editor.ts`, `e2e/editor-chapters.spec.ts`, `docs/user/editor.md`
- Modify: `frontend/src/App.tsx` (route `project` shows `EditorScreen`), `frontend/src/features/teams/TeamDetail.tsx` (shows `ProjectList`; Delete team confirm names the project count, D13), `docs/README.md` (link the user manual page)

**Interfaces:**
- Consumes: `backend.projects` (Task 7); `editorStore`, `useEditor`, `liveChapters`, `placeAt`, `insertAt`, `newId` (Task 8); `useRoute`, `navigate` (Task 1).
- Produces, `chapters/tabsView.ts` (view state of this browser only, never saved):

```ts
export interface TabsView { closed: ReadonlySet<string>; widths: Readonly<Record<string, number>> }
export const EMPTY_TABS: TabsView
export const TAB_MIN = 80, TAB_MAX = 320, TAB_DEFAULT = 160
export function closeTab(v: TabsView, id: string): TabsView
export function openTab(v: TabsView, id: string): TabsView
export function setTabWidth(v: TabsView, id: string, width: number): TabsView   // clamped to [TAB_MIN, TAB_MAX]; NaN -> TAB_DEFAULT
export function visibleTabs(chapters: Chapter[], v: TabsView): Chapter[]        // live chapters in order, minus closed
export function activeAfterClose(visible: Chapter[], closedId: string, activeId: string | null): string | null
// closing a tab that is not active keeps activeId; closing the active one picks the tab to its right, else to its left, else null
```

- Produces, `chapters/useTabsView.ts`: a zustand store `{ view: TabsView; close(id: string): void; open(id: string): void; setWidth(id: string, width: number): void; reset(): void }` built on the functions above (reset when a project opens), so other features (Task 13's jump) can reopen a tab.
- Produces, `chapters/chapterMoves.ts`:

```ts
export type ChapterMove = { kind: 'one'; id: string; position: number } | { kind: 'renumber'; positions: { id: string; position: number }[] }
export function moveChapter(ordered: Chapter[], id: string, direction: 'left' | 'right'): ChapterMove | null
// a thin wrapper: maps chapters to { id, order: position } and calls placeAt (Task 8) with the index one left or right;
// null when the chapter is already first (left) or last (right), or not in the list
```

- Produces, `e2e/helpers/editor.ts`: `ownerWithProject(page: Page, projectName: string): Promise<{ email: string }>` (sign up, verify, sign in, create a team, create the project, open it; waits for the `Chapter 1` tab).
- Produces: `EditorScreen` regions with test ids `editor-left`, `editor-canvas`, `editor-panel`, and `ErrorBanner` showing `useEditor(s => s.error)` with a Dismiss button (`role="alert"`). When `open` fails (status `error`), the editor shows only `This project does not exist or you are not a member of its team.` and a `Back to teams` button.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 9A: Tab view and chapter moves (pure)

- [ ] **Step 1: Write the failing tests** C1 to C4.
- [ ] **Step 2: Run** `npx vitest run --project unit frontend/src/features/editor/chapters`. Expected: FAIL.
- [ ] **Step 3: Implement `tabsView.ts` and `chapterMoves.ts`.** The clamp is `Math.min(TAB_MAX, Math.max(TAB_MIN, width))` (break B1).
- [ ] **Step 4: Run** them. Expected: PASS. **Close checkpoint 9A** (commit `feat: chapter tab view and moves`).

## Checkpoint 9B: Project list, editor frame and chapter tabs

- [ ] **Step 5: Write `e2e/helpers/editor.ts` and the failing e2e tests** C5 to C10 in `e2e/editor-chapters.spec.ts`.
- [ ] **Step 6: Run** `npm run test:e2e -- e2e/editor-chapters.spec.ts`. Expected: FAIL.
- [ ] **Step 7: Implement.** `ProjectList` (name field and `New project` for members; each project opens `#/project/<id>`; `Move to trash` shown only to the owner, with a confirm). `EditorScreen` calls `editorStore.getState().open(projectId)` on mount and `close()` on unmount; when the route has no chapter, it navigates to the first live chapter. `ChapterList` (left): every live chapter, `Add chapter` (title `Chapter <n+1>`, position after the last), rename on double-click, `Move to trash` with a confirm, and a closed chapter opens its tab again when clicked. `ChapterTabs`: visible tabs, `×` closes (D10), a drag handle on the right edge sets the width, a menu with `Move left` and `Move right` (applies `moveChapter`; a renumber sends one update per chapter). The project name in the left panel renames on double-click.
- [ ] **Step 8: Run** `npm run test:e2e`. Expected: PASS.
- [ ] **Step 9: Write `docs/user/editor.md`** (first section: projects and chapters, what closing a tab does versus moving a chapter to the trash) and link it from `docs/README.md`. **Close checkpoint 9B** (commit `feat: projects, editor frame and chapter tabs`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | closing tabs | unit | close the active middle tab; the active last tab; the only tab; a non-active tab | right neighbour; left neighbour; `null`; unchanged | frontend/src/features/editor/chapters/tabsView.test.ts :: closing a tab picks the next active tab |
| C2 | widths are clamped | unit | `setTabWidth` with 10, 500, 200, NaN | 80, 320, 200, 160 | frontend/src/features/editor/chapters/tabsView.test.ts :: tab widths stay between the limits |
| C3 | visible tabs | unit | chapters with one trashed and one closed; reopen the closed one | both hidden; then shown in position order | frontend/src/features/editor/chapters/tabsView.test.ts :: trashed and closed chapters have no tab |
| C4 | moving chapters | unit | positions A 1, B 2, C 3: move C left; move B left; move A left; move C right; A and B both at 1 and C at 3, move C left | `one` C 1.5; `one` B 0; `null`; `null`; `renumber` giving A 1, C 2, B 3 | frontend/src/features/editor/chapters/chapterMoves.test.ts :: moveChapter swaps neighbours and renumbers when there is no room |
| C5 | new project opens with a first chapter | e2e | member creates `Story` and opens it | editor with a `Chapter 1` tab and the three regions | e2e/editor-chapters.spec.ts :: a new project opens with Chapter 1 |
| C6 | chapters persist | e2e | add `Chapter 2`, rename it `The Door`, move it left, reload | tabs `The Door`, `Chapter 1` in that order after reload | e2e/editor-chapters.spec.ts :: chapter names and order survive a reload |
| C7 | close versus trash | e2e | close a tab, reopen it from the list; trash a chapter | tab back; trashed chapter gone from tabs and list after a reload | e2e/editor-chapters.spec.ts :: closing a tab hides it and trashing removes the chapter |
| C8 | only the owner trashes projects | e2e | member opens the team; owner trashes the project | member sees no `Move to trash` (after the list has loaded); owner's list no longer shows it | e2e/editor-chapters.spec.ts :: only the owner can move a project to the trash |
| C9 | team delete warns about projects | e2e | owner of a team with 2 projects clicks Delete team | confirm text `Delete this team and its 2 projects?` | e2e/editor-chapters.spec.ts :: deleting a team names its project count |
| C10 | an outsider cannot open a project | e2e | a signed-in user outside the team opens `#/project/<id>` | the not-found text and `Back to teams`; no chapter names shown | e2e/editor-chapters.spec.ts :: an outsider sees no project content |
### Probes
**Probe folder:** `tests/probes/2026-11-14-editor-core/task-9/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/chapters/tabsView.ts | `Math.min(TAB_MAX, Math.max(TAB_MIN, width))` | `Math.min(TAB_MAX, width)` | frontend/src/features/editor/chapters/tabsView.test.ts |
### Flow
Create a project, add three chapters, rename, reorder, close and reopen tabs, resize a tab, trash a chapter, reload; in Firefox and Chromium. Record what you saw in `progress.md`.
### Evidence
The full output of `npm run check:task`, the failing run of B1, and the Flow record.
