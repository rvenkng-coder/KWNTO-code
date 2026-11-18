# Task 1: Draw.io-style tab bar

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** none

This task turns the chapter tab strip into the one place for chapter actions (design goals 2 and 3):

- **"≡" at the start** lists all chapters.
- **Each tab** has its title (double-click to rename), a ▾ menu, × and the resize handle.
- **"+" at the end** adds a chapter.

Menus render in a portal, so the strip's `overflow-x-auto` can no longer clip them. That clipping is the bug where the menu opened hidden under the canvas. The left chapter list is removed.

**Files:**
- Create:
  - `frontend/src/features/editor/chapters/menuPosition.ts`
  - `frontend/src/features/editor/chapters/menuPosition.test.ts`
  - `frontend/src/features/editor/chapters/Popover.tsx`
  - `frontend/src/features/editor/chapters/TabMenu.tsx`
  - `frontend/src/features/editor/chapters/AllChaptersMenu.tsx`
  - `e2e/editor-tabs.spec.ts`
- Modify:
  - `frontend/src/features/editor/chapters/ChapterTabs.tsx`: the old inline `TabMenu` moves out. It gains "≡" and "+".
  - `frontend/src/features/editor/chapters/InlineText.tsx`
  - `frontend/src/features/editor/EditorScreen.tsx`: the left panel loses `ChapterList`.
  - `e2e/editor-chapters.spec.ts`: two tests drive the tabs instead of the removed list. See Step 1B.4.
- Delete: `frontend/src/features/editor/chapters/ChapterList.tsx`

**Interfaces:**
- Consumes:
  - from `chapterActions.ts`: `addChapter`, `renameChapter`, `trashChapter`, `shiftChapter`
  - from `useTabsView`: `view`, `open`, `close`, `setWidth`
  - from `tabsView.ts`: `visibleTabs`, `activeAfterClose`, `TAB_DEFAULT`
  - `navigate` (shell)
- Produces, `chapters/menuPosition.ts`:

```ts
export interface Box { left: number; top: number; width: number; height: number }
export interface Size { width: number; height: number }
export const MENU_MARGIN = 8
export function menuPosition(anchor: Box, menu: Size, viewport: Size): { left: number; top: number }
```

- Produces, `chapters/Popover.tsx`:

```ts
interface PopoverProps { anchor: HTMLElement; label: string; onClose(): void; children: ReactNode }
export function Popover(props: PopoverProps): ReactPortal   // role="menu", aria-label={label}, position: fixed
```

- Produces, `chapters/InlineText.tsx`. These optional props are added and the existing ones are unchanged:

```ts
editing?: boolean                         // controlled when given; otherwise its own state, as today
onEditingChange?: (editing: boolean) => void
role?: 'tab'                              // the display button gets role="tab"
selected?: boolean                        // aria-selected on that button
```

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 1A: Where a menu goes

- [x] **Step 1A.1: Write the failing tests** in `menuPosition.test.ts`, using `describe('menuPosition')` with a window of `{ width: 1280, height: 720 }` and a menu of `{ width: 160, height: 120 }`:
  - `places the menu below the anchor when it fits`: anchor `{ left: 100, top: 20, width: 20, height: 20 }` gives `{ left: 100, top: 40 }`.
  - `keeps the menu inside the right edge`: anchor `{ left: 1250, top: 20, width: 20, height: 20 }` gives `{ left: 1112, top: 40 }`.
  - `opens above the anchor when there is no room below`: anchor `{ left: 100, top: 680, width: 20, height: 20 }` gives `{ left: 100, top: 560 }`.
  - `never leaves the window when the window is smaller than the menu`: window `{ width: 100, height: 100 }` and anchor `{ left: 10, top: 10, width: 20, height: 20 }` give `{ left: 8, top: 8 }`.
- [x] **Step 1A.2: Run** `npx vitest run --project unit frontend/src/features/editor/chapters/menuPosition.test.ts`. Expect a FAIL, because the module does not exist yet.
- [x] **Step 1A.3: Implement `menuPosition`.** The Breaks table matches this exact text:

```ts
/** Below the anchor, left edges aligned; above it when there is no room below; always inside the window. */
export function menuPosition(anchor: Box, menu: Size, viewport: Size): { left: number; top: number } {
  const below = anchor.top + anchor.height
  const fitsBelow = below + menu.height + MENU_MARGIN <= viewport.height
  const top = fitsBelow ? below : anchor.top - menu.height
  return { left: clamp(anchor.left, viewport.width - menu.width - MENU_MARGIN), top: clamp(top, viewport.height - menu.height - MENU_MARGIN) }
}

function clamp(value: number, max: number): number {
  return Math.max(MENU_MARGIN, Math.min(value, max))
}
```

- [x] **Step 1A.4: Run.** Expect a PASS. Close the checkpoint with one commit: `feat: place chapter menus inside the window`.

## Checkpoint 1B: The tab bar

- [ ] **Step 1B.1: Write the failing e2e tests** in `e2e/editor-tabs.spec.ts`. Give each test a `// Protects:` header. Use `ownerWithProject`, `waitForSave` and `tabTitles` from `e2e/helpers/editor.ts`.
  - **`the tab menu shows above the canvas and every item can be clicked`**
    1. Add a chapter with the `Add chapter` button. Wait for the POST.
    2. Click `Menu for Chapter 2`.
    3. The `Chapter menu` menu has the items `Rename`, `Move left`, `Move right` and `Move to trash`.
    4. For each item, `toBeInViewport({ ratio: 1 })` holds, and `document.elementFromPoint` at the item's centre, `.closest('[role="menuitem"]')`, has the item's text.
  - **`a menu closes with Escape and with a click outside`**
    1. Open `Menu for Chapter 1` and press Escape. The menu count is 0.
    2. Open it again and click the canvas at `{ x: 20, y: 20 }`. The menu count is 0, and the node count is unchanged, because a single click adds nothing.
  - **`rename from the tab menu`**
    1. Choose `Rename` from `Menu for Chapter 1`.
    2. Fill the `Chapter title` box with `Prologue` and press Enter. Wait for the PATCH.
    3. `tabTitles` is `['Prologue']`. After a reload it is still `['Prologue']`.
  - **`the All chapters list opens a closed tab`**
    1. Add `Chapter 2` and click `Close Chapter 2`.
    2. Open `All chapters`. It has the menu items `Chapter 1` and `Chapter 2`, and `Chapter 1` has `aria-current="true"`.
    3. Click `Chapter 2`. The `Chapter 2` tab is visible with `aria-selected="true"`.
  - **`trashing the open chapter shows its neighbour`**
    1. Add `Chapter 2`, which is now open. Accept the dialog.
    2. Choose `Move to trash` from `Menu for Chapter 2`. Wait for the PATCH.
    3. `tabTitles` is `['Chapter 1']`, the `Chapter 1` tab has `aria-selected="true"`, and `getByTestId('canvas')` is visible.
  - **`chapter actions live in the tab bar, not the left panel`**
    1. `getByTestId('chapter-list')` has count 0.
    2. `getByRole('button', { name: 'Add chapter' })` is inside `getByTestId('editor-canvas')`.
    3. `getByRole('button', { name: 'All chapters' })` is visible.
- [ ] **Step 1B.2: Run** `npm run test:e2e -- e2e/editor-tabs.spec.ts`. Expect a FAIL. Record which tests fail and why. The first must fail on the clipped menu, which reproduces the bug.
- [ ] **Step 1B.3: Implement.**
  - **`Popover`:**
    - Renders with `createPortal(…, document.body)` at `position: fixed`.
    - Measures itself after the first render (`useLayoutEffect`) and places itself with `menuPosition(anchor.getBoundingClientRect(), own size, { width: innerWidth, height: innerHeight })`.
    - Its `z-index` is above React Flow's controls, so use a theme-safe Tailwind `z-50`.
    - Closes by E1: Escape on `document`, `pointerdown` outside both the menu and the anchor, `resize`, and `scroll` with `capture: true` on `window`.
    - On close by Escape, focus returns to the anchor.
  - **`TabMenu`:** the ▾ button (`Menu for <title>`, `aria-haspopup="menu"`, `aria-expanded`) opens a `Popover` labelled `Chapter menu`. Its items:
    - `Rename` sets the tab's `InlineText` to editing.
    - `Move left` and `Move right` call `shiftChapter` and are disabled at the ends, as today.
    - `Move to trash` asks `Move "<title>" to the trash?` and, if confirmed, calls `trashChapter`. If it was the open chapter, it then navigates to `activeAfterClose(visible, id, activeId)`.
  - **`AllChaptersMenu`:** the "≡" button, named `All chapters`, opens a `Popover` labelled `All chapters`, with one `menuitem` per live chapter in order (E3). A click calls `open(id)` and navigates to it.
  - **`ChapterTabs`:**
    - "≡", then the tabs, then a "+" button named `Add chapter` that calls `addChapter`, opens the new tab and navigates to it.
    - The tab title is an `InlineText` with `role="tab"`, `selected`, the label `Chapter title`, and an `onClick` that navigates. Editing is controlled by the tab so that `Rename` can start it.
  - **`EditorScreen`:** remove `ChapterList` and its import, then delete `ChapterList.tsx`.
- [ ] **Step 1B.4: Move the two old chapter tests to the tab bar.** The left list no longer exists. Change only how each step is reached; every assertion stays the same.
  - **`chapter names and order survive a reload`:** rename by double-clicking the `Chapter 2` tab title instead of the list row.
  - **`closing a tab hides it and trashing removes the chapter`:**
    - "is in the list" becomes "is an item of `All chapters`".
    - Reopening uses `All chapters` → `Chapter 2`.
    - Trashing uses `Menu for Chapter 2` → `Move to trash`.
    - The last check is that `All chapters` has no `Chapter 2` item.
  - **The `chapterRow` helper** is deleted. Update the header comment to say "the All chapters list reopens it".
- [ ] **Step 1B.5: Run** `npm run test:e2e -- e2e/editor-tabs.spec.ts e2e/editor-chapters.spec.ts e2e/editor-panel.spec.ts e2e/editor-search-links.spec.ts e2e/editor-undo-paste.spec.ts`, plus `npm run lint` and `npm run typecheck`. Expect a PASS in both browsers. Close the checkpoint with one commit: `feat: draw.io-style chapter tab bar`.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | menu below its anchor | unit | anchor at 100,20 (20×20), menu 160×120, window 1280×720 | `{ left: 100, top: 40 }` | frontend/src/features/editor/chapters/menuPosition.test.ts :: places the menu below the anchor when it fits |
| C2 | right edge | unit | anchor at left 1250 | `left: 1112` | frontend/src/features/editor/chapters/menuPosition.test.ts :: keeps the menu inside the right edge |
| C3 | bottom edge flips above | unit | anchor at top 680 | `top: 560` | frontend/src/features/editor/chapters/menuPosition.test.ts :: opens above the anchor when there is no room below |
| C4 | tiny window | unit | window 100×100 | `{ left: 8, top: 8 }` | frontend/src/features/editor/chapters/menuPosition.test.ts :: never leaves the window when the window is smaller than the menu |
| C5 | menu is on top and clickable (the bug) | e2e | open `Menu for Chapter 2` | 4 items, each fully in view and topmost at its centre | e2e/editor-tabs.spec.ts :: the tab menu shows above the canvas and every item can be clicked |
| C6 | menus close | e2e | Escape; click on the canvas | no menu; no node added | e2e/editor-tabs.spec.ts :: a menu closes with Escape and with a click outside |
| C7 | rename from the menu | e2e | Rename → `Prologue`, reload | tab `Prologue` before and after reload | e2e/editor-tabs.spec.ts :: rename from the tab menu |
| C8 | reopen a closed tab | e2e | close Chapter 2, All chapters → Chapter 2 | tab back and selected; open chapter marked current | e2e/editor-tabs.spec.ts :: the All chapters list opens a closed tab |
| C9 | trash the open chapter | e2e | trash Chapter 2 while open | Chapter 1 selected, canvas shown | e2e/editor-tabs.spec.ts :: trashing the open chapter shows its neighbour |
| C10 | left list gone | e2e | open a project | no `chapter-list`; `Add chapter` in the centre region; `All chapters` visible | e2e/editor-tabs.spec.ts :: chapter actions live in the tab bar, not the left panel |
| C11 | chapters persist (moved test) | e2e | add, rename by tab double-click, move left, reload | `The Door`, `Chapter 1` | e2e/editor-chapters.spec.ts :: chapter names and order survive a reload |
| C12 | close versus trash (moved test) | e2e | close, reopen from All chapters, trash from tab menu, reload | tab back; then gone from tabs and All chapters | e2e/editor-chapters.spec.ts :: closing a tab hides it and trashing removes the chapter |
### Probes
**Probe folder:** none
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/chapters/menuPosition.ts | `Math.max(MENU_MARGIN, Math.min(value, max))` | `Math.min(value, max)` | frontend/src/features/editor/chapters/menuPosition.test.ts |
| B2 | frontend/src/features/editor/chapters/menuPosition.ts | `fitsBelow ? below : anchor.top - menu.height` | `below` | frontend/src/features/editor/chapters/menuPosition.test.ts |
| B3 | frontend/src/features/editor/chapters/menuPosition.ts | `viewport.width - menu.width - MENU_MARGIN` | `viewport.width` | frontend/src/features/editor/chapters/menuPosition.test.ts |
### Flow
1. Open a project with five chapters in a narrow window (about 1000 px), so the strip scrolls.
2. Open the menu of the last tab and of the first. Use every item.
3. Close two tabs and reopen them from "≡".
4. Do this in Firefox and in Chromium, in light and dark mode.

Record what you saw in `progress.md`.
### Evidence
The full output of `npm run check:task`, the failing runs of Steps 1A.2 and 1B.2, and the Flow record.
