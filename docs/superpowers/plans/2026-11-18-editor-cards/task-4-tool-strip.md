# Task 4: Tool strip, Cut, left panel and scrolling

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** Task 1

This task covers design goal 3:

- a tool strip at the left edge of the canvas with tooltips
- Cut, as a new action with `Ctrl/⌘+X`
- Area select as a toggle
- a left panel that collapses and is remembered in this browser
- side panels that scroll on their own while the page never scrolls

The left panel's text Add node button and its hint move into the strip.

**Files:**
- Create:
  - `frontend/src/features/editor/model/shortcutLabel.ts`
  - `frontend/src/features/editor/model/shortcutLabel.test.ts`
  - `frontend/src/features/editor/canvas/icons.tsx`
  - `frontend/src/features/editor/canvas/ToolButton.tsx`
  - `frontend/src/features/editor/canvas/ToolStrip.tsx`
  - `frontend/src/features/editor/useLeftPanel.ts`
  - `e2e/editor-tools.spec.ts`
- Modify:
  - `frontend/src/features/editor/model/shortcuts.ts`: `'cut'` on `mx`.
  - `frontend/src/features/editor/model/shortcuts.test.ts`
  - `frontend/src/features/editor/useShortcuts.ts`
  - `frontend/src/features/editor/store/edits.ts`: `cut`.
  - `frontend/src/features/editor/store/editorStore.ts`: `hasClip`.
  - `frontend/src/features/editor/canvas/canvasCommands.ts`: `areaSelect`.
  - `frontend/src/features/editor/canvas/Canvas.tsx`
  - `frontend/src/features/editor/EditorScreen.tsx`: the layout, the strip and the left-panel toggle.
  - `frontend/src/features/editor/chapters/ChapterTabs.tsx`: the panel toggle sits before "≡".
  - `e2e/editor-add-node.spec.ts`: only the hint assertion changes, so the text is read from the Add node tooltip.

**Interfaces:**
- Produces, `model/shortcutLabel.ts`:

```ts
export function shortcutLabel(key: string, isMac: boolean): string   // ('X', false) -> 'Ctrl+X'; ('X', true) -> '⌘X'
export function isMacPlatform(platform: string): boolean              // /Mac|iPhone|iPad/.test(platform)
```

- Produces:
  - `model/shortcuts.ts`: `ShortcutAction` gains `'cut'`.
  - `edits.cut(nodeIds: string[]): Promise<void>`: copy, then trash the nodes, as one group labelled `Cut`.
  - `EditorStore.hasClip: boolean`: false at first, true after a copy or cut that took at least one node (F4).
- Produces, `canvas/canvasCommands.ts` (added to the existing store):

```ts
areaSelect: boolean
toggleAreaSelect(): void
```

- Produces, `canvas/ToolButton.tsx`:

```ts
interface ToolButtonProps { icon: IconName; name: string; hint?: string; onClick(): void; disabled?: boolean; pressed?: boolean }
export function ToolButton(props: ToolButtonProps): JSX.Element
// aria-label={name}; tooltip (role="tooltip", aria-describedby) reads `${name} (${hint})` or name; shown after 300 ms hover, at once on focus
```

- Produces, `canvas/icons.tsx`: `export type IconName = 'add' | 'cut' | 'copy' | 'paste' | 'trash' | 'select' | 'panel'` and `export function Icon({ name }: { name: IconName }): JSX.Element`. These are inline SVG, `currentColor`, 16 px, and `aria-hidden`.
- Produces, `useLeftPanel.ts`: `export const useLeftPanel: UseBoundStore<StoreApi<{ shown: boolean; toggle(): void }>>`. It reads and writes `localStorage['kwnto.leftPanel']`, with every access in try/catch (F6).

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 4A: Shortcut labels and Cut

- [x] **Step 4A.1: Write the failing unit tests.**
  - **`shortcutLabel.test.ts`, `shortcut labels read Ctrl on Windows and Linux and ⌘ on a Mac`:**
    - `shortcutLabel('X', false)` is `'Ctrl+X'`, and `shortcutLabel('X', true)` is `'⌘X'`.
    - `isMacPlatform('MacIntel')` is `true`, and `isMacPlatform('Linux x86_64')` is `false`.
  - **`shortcuts.test.ts`, `Ctrl+X is cut outside a text field only`:**
    - `shortcutFor({ key: 'x', ctrlKey: true, … }, false)` is `'cut'`.
    - With `metaKey` instead, it is `'cut'`.
    - Inside a text field it is `null`.
- [x] **Step 4A.2: Run** `npx vitest run --project unit frontend/src/features/editor/model/shortcutLabel.test.ts frontend/src/features/editor/model/shortcuts.test.ts`. Expect a FAIL.
- [x] **Step 4A.3: Implement.** `shortcutLabel` is this exact text:

```ts
export function shortcutLabel(key: string, isMac: boolean): string {
  return isMac ? `⌘${key}` : `Ctrl+${key}`
}
```

  Then:
  - insert `mx: 'cut', ` into the shortcut map literal, directly before `mc: 'copy'`
  - add `cut: () => void edits.cut(nodeIds)` in `useShortcuts`
  - write `edits.cut`
  - set `hasClip` in `copy` and `cut`
- [x] **Step 4A.4: Run.** Expect a PASS. Close the checkpoint with one commit: `feat: cut, and shortcut labels for each platform`.

## Checkpoint 4B: The strip and the panels

- [x] **Step 4B.1: Write the failing e2e tests** in `e2e/editor-tools.spec.ts`. Give each a `// Protects:` header. The strip is `getByTestId('tool-strip')`.
  - **`each tool shows its shortcut in a tooltip`**
    1. For each pair, focus the button with that accessible name and expect `getByRole('tooltip')` to have that text:
       - `Add node`: `Add node (or double-click the canvas)`
       - `Cut`: `Cut (Ctrl+X)`
       - `Copy`: `Copy (Ctrl+C)`
       - `Paste`: `Paste (Ctrl+V)`
       - `Move to trash`: `Move to trash (Delete)`
       - `Area select`: `Area select (or Shift+drag)`
    2. The strip is left of the canvas centre: its box x is less than the `canvas` box x plus 60.
  - **`cut moves a node to the clipboard and the trash in one undo step`**
    1. Select a node. `Cut` and `Copy` are enabled, and `Paste` is disabled.
    2. Click `Cut`. Wait for the PATCH. The card count is 0, and `Paste` is enabled.
    3. Click `Paste`. Wait for the POST. The card count is 1.
    4. Press Ctrl+Z twice. The cut node is back and the pasted one is gone, so there is still 1 card, with the original id.
  - **`area select draws a box that selects the nodes inside`**
    1. Take three nodes and click `Area select`, so `aria-pressed="true"`.
    2. Drag across two of them on empty canvas.
    3. The panel shows `2 nodes selected`.
    4. Click `Area select` off, and a drag on empty canvas pans: a node's screen position changes.
  - **`the left panel collapses and stays collapsed after a reload`**
    1. Click `Hide project panel`. `editor-left` is hidden, and the canvas box is wider than before.
    2. Reload. It is still hidden.
    3. `Show project panel` brings it back.
  - **`a long properties panel scrolls inside itself and the page does not scroll`**
    1. Give a node 40 script lines.
    2. `editor-panel` has `scrollHeight > clientHeight`, and `document.documentElement.scrollHeight` equals `innerHeight`.
- [x] **Step 4B.2: Run** `npm run test:e2e -- e2e/editor-tools.spec.ts`. Expect a FAIL.
- [x] **Step 4B.3: Implement.**
  - **`ToolStrip`** (`data-testid="tool-strip"`) is a vertical column of `ToolButton`s at the left inside edge of the canvas, in the design's order. Each `hint` comes from `shortcutLabel(…, isMacPlatform(navigator.platform))`.
  - **Button state:**
    - Cut, Copy and Delete are disabled with no node selected.
    - Paste is disabled while `!hasClip`.
    - Add node is disabled when `addNode === null`.
  - **`Canvas.tsx`:** `selectionOnDrag={areaSelect}` and `panOnDrag={!areaSelect}` (F5).
  - **`EditorScreen`:**
    - The frame fills the window height with `flex` and `min-h-0`, and the canvas is `flex-1`. Drop the fixed `calc(100vh-14rem)` canvas height.
    - Each `aside` gets `overflow-y-auto`.
    - The left `aside` renders only when `shown`, and the grid columns follow.
    - Remove the old Add node text button and hint.
  - **`ChapterTabs`:** first, a `ToolButton` with icon `panel`, named `Hide project panel` or `Show project panel` according to `shown`.
  - **`editor-add-node.spec.ts`:** replace only the hint assertion with focusing `Add node` and expecting the tooltip `Add node (or double-click the canvas)`.
- [x] **Step 4B.4: Run** the new spec, then `npm run test:e2e -- e2e/editor-add-node.spec.ts e2e/editor-tabs.spec.ts e2e/editor-undo-paste.spec.ts e2e/editor-canvas.spec.ts`, plus lint and typecheck. Expect a PASS. Close the checkpoint with one commit: `feat: tool strip, cut, area select and a collapsible left panel`.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | shortcut labels | unit | `('X', false)`, `('X', true)`, two platforms | `Ctrl+X`, `⌘X`, true, false | frontend/src/features/editor/model/shortcutLabel.test.ts :: shortcut labels read Ctrl on Windows and Linux and ⌘ on a Mac |
| C2 | Ctrl+X is cut | unit | Ctrl+X, ⌘+X, in a text field | `cut`, `cut`, `null` | frontend/src/features/editor/model/shortcuts.test.ts :: Ctrl+X is cut outside a text field only |
| C3 | tooltips | e2e | focus each tool | exact tooltip text; strip on the left | e2e/editor-tools.spec.ts :: each tool shows its shortcut in a tooltip |
| C4 | cut, paste, undo | e2e | Cut, Paste, Ctrl+Z twice | node trashed then pasted; undo restores the original | e2e/editor-tools.spec.ts :: cut moves a node to the clipboard and the trash in one undo step |
| C5 | area select | e2e | toggle on, drag over two of three | `2 nodes selected`; off pans | e2e/editor-tools.spec.ts :: area select draws a box that selects the nodes inside |
| C6 | left panel remembered | e2e | hide, reload, show | hidden after reload; shown again | e2e/editor-tools.spec.ts :: the left panel collapses and stays collapsed after a reload |
| C7 | panels scroll, page does not | e2e | 40 lines | panel scrolls; page height equals the window | e2e/editor-tools.spec.ts :: a long properties panel scrolls inside itself and the page does not scroll |
### Probes
**Probe folder:** none
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/model/shortcutLabel.ts | `return isMac ?` | `return false ?` | frontend/src/features/editor/model/shortcutLabel.test.ts |
| B2 | frontend/src/features/editor/model/shortcuts.ts | `mx: 'cut', ` | `` | frontend/src/features/editor/model/shortcuts.test.ts |
### Flow
1. Use every tool by mouse and by keyboard (Tab to the strip, then Enter).
2. Hide and show the left panel.
3. Fill a node with many lines and cues and scroll both panels.
4. Do this in Firefox and in Chromium, in light and dark mode.

Record what you saw in `progress.md`.
### Evidence
The full output of `npm run check:task`, the failing runs of Steps 4A.2 and 4B.2, and the Flow record.
