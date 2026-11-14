# Task 12: Undo/redo, copy/paste, shortcuts

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Checkpoint 12A tier:** local
**Depends on:** Task 11

Design 6.1 (undo/redo, copy/paste, multi-select) and 8b (undo history is a unit-test priority), with decisions D5 (100 steps, own edits, never over a teammate's change), D11 (in-app clipboard) and D12 (shortcuts). Undo writes ordinary guarded updates, so it is safe with teammates editing at the same time.

**Files:**
- Create: `frontend/src/features/editor/model/shortcuts.ts`, `shortcuts.test.ts`, `history.ts`, `history.test.ts`, `clipboard.ts`, `clipboard.test.ts` (in `model/`); `frontend/src/features/editor/store/edits.ts`, `frontend/src/features/editor/store/edits.test.ts`, `frontend/src/features/editor/useShortcuts.ts`, `e2e/editor-undo-paste.spec.ts`
- Modify: `frontend/src/features/editor/canvas/Canvas.tsx`, `CanvasToolbar.tsx` and the files in `frontend/src/features/editor/panel/` and `chapters/` (every content change goes through `edits` instead of `editorStore` directly; React Flow's own `deleteKeyCode` is turned off), `frontend/src/features/editor/EditorScreen.tsx` (mounts `useShortcuts`; Undo and Redo buttons in the canvas toolbar), `docs/user/editor.md`, `docs/developer/editor.md`

**Interfaces:**
- Consumes: `editorStore`, `ContentState`, `liveNodes`, `linesOf`, `cuesOf`, `newId` (Task 8); `useSelection` (Task 10); `pendingEdits` (Task 11).
- Produces, `model/shortcuts.ts`:

```ts
export type ShortcutAction = 'undo' | 'redo' | 'copy' | 'paste' | 'delete' | 'search' | 'selectAll'
export interface KeyInput { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }
export function shortcutFor(e: KeyInput, inTextField: boolean): ShortcutAction | null
// Ctrl or Meta: z -> undo, Shift+z -> redo, y -> redo, c -> copy, v -> paste, k -> search, a -> selectAll (key compared lower-cased);
// Delete or Backspace with no modifier -> delete; Alt held -> null; in a text field only 'search' is returned, everything else null
```

- Produces, `model/history.ts`:

```ts
export type Change =
  | { type: 'update'; kind: ContentKind; id: string; before: Record<string, unknown>; after: Record<string, unknown> }
  | { type: 'create'; kind: RemovableKind; record: ContentRecords[RemovableKind] }
  | { type: 'remove'; kind: RemovableKind; record: ContentRecords[RemovableKind] }
// Creating a chapter or node is recorded as an update of `deleted` from true to false, so undo trashes it and redo restores it.
export interface Step { label: string; changes: Change[] }
export interface History { past: Step[]; future: Step[] }
export const HISTORY_DEPTH = 100
export const EMPTY_HISTORY: History
export function recordStep(h: History, step: Step): History        // empty step ignored; clears future; keeps the last HISTORY_DEPTH
export function invert(step: Step): Step                             // changes reversed; update swaps before/after; create <-> remove
export function takeUndo(h: History): { history: History; step: Step } | null  // step is the inverse to apply
export function takeRedo(h: History): { history: History; step: Step } | null  // step is the original to apply again
export function canApply(change: Change, s: ContentState): boolean
// update: the record exists and each key of `before` equals its current value (JSON comparison);
// create: no record with that id; remove: the record exists and its editable fields equal those in change.record
export const UNDO_BLOCKED = "Can't undo: someone else changed this since."
export const REDO_BLOCKED = "Can't redo: someone else changed this since."
```

- Produces, `model/clipboard.ts`:

```ts
export interface Clip { nodes: StoryNode[]; lines: ScriptLine[]; cues: Cue[]; connections: Connection[] }
export const PASTE_OFFSET = 40
export function copySelection(s: ContentState, nodeIds: string[]): Clip | null  // live nodes among nodeIds with their lines and cues and the connections between them; null if none
export function buildPaste(clip: Clip, target: { projectId: string; chapterId: string }, pasteCount: number, makeId: () => string): Clip
// every record gets a new id from makeId; references remapped; x and y moved by PASTE_OFFSET * pasteCount; version 0; deleted false
```

- Produces, `store/edits.ts` (the only way screens change content from now on):

```ts
export const edits: {
  create<K extends CreatableKind>(kind: K, record: ContentRecords[K], label: string): Promise<boolean>
  update<K extends ContentKind>(kind: K, id: string, changes: Partial<EditableFields[K]>, label: string): Promise<boolean>
  remove(kind: RemovableKind, id: string, label: string): Promise<boolean>
  group(label: string, run: () => Promise<void>): Promise<void>   // everything recorded inside is one step
  undo(): Promise<void>; redo(): Promise<void>                    // flush pending text first; skip a blocked step with UNDO_BLOCKED / REDO_BLOCKED as the store error
  copy(nodeIds: string[]): void; paste(chapterId: string): Promise<void>
  reset(): void                                                   // called when a project opens or closes (history is per open project)
}
export function createEdits(store: StoreApi<EditorStore>, flush: () => void): typeof edits // for tests
```

  A step is recorded only after its writes succeed. A multi-node drag, trashing a selection and a paste are one step each.

**If interrupted:** nothing leaves state outside the working tree.

## Sized for the local model
**May touch:** `frontend/src/features/editor/model/shortcuts.ts`, `frontend/src/features/editor/model/shortcuts.test.ts` (exhaustive: no other file)
**Must not change:** the `ShortcutAction` and `KeyInput` types and the signature of `shortcutFor`
Stop and report if you need to touch anything else.
**Model server:** run `npm run ping:model` first; if it says NOT answering, do not start the run (see [the runbook](../../../developer/local-model-runbook.md))
**Checkpoint given:** Checkpoint 12A only

## Checkpoint 12A: Shortcuts (local)

- [ ] **Step 1: Write the failing tests** C1 to C3.
- [ ] **Step 2: Run** `npx vitest run --project unit frontend/src/features/editor/model/shortcuts.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `shortcuts.ts`.** The text-field rule is the line `if (inTextField) return action === 'search' ? action : null` (break B1).
- [ ] **Step 4: Run** it. Expected: PASS. **Close checkpoint 12A** (commit `feat: editor shortcuts`).

## Checkpoint 12B: History and clipboard (pure)

- [ ] **Step 5: Write the failing tests** C4 to C9.
- [ ] **Step 6: Run** `npx vitest run --project unit frontend/src/features/editor/model`. Expected: the new tests FAIL.
- [ ] **Step 7: Implement `history.ts` and `clipboard.ts`.** Keep the depth with `past.slice(-HISTORY_DEPTH)`, compare fields in `canApply` through one helper `sameValue(current[key], change.before[key])`, and keep connections with `ids.has(c.fromNodeId) && ids.has(c.toNodeId)` (breaks B2 to B4).
- [ ] **Step 8: Run** them. Expected: PASS. **Close checkpoint 12B** (commit `feat: undo history and clipboard`).

## Checkpoint 12C: Wiring and flows

- [ ] **Step 9: Write the failing tests** C10 (unit, `edits.test.ts` with a store made by `createEditorStore` on a fake door) and C11 to C14 (`e2e/editor-undo-paste.spec.ts`).
- [ ] **Step 10: Run** them. Expected: FAIL.
- [ ] **Step 11: Implement `edits.ts` and `useShortcuts.ts`**, and move every content change in the canvas, panel and chapter components onto `edits` (labels such as `Rename node`, `Move 3 nodes`, `Paste 2 nodes`). `useShortcuts` listens on `window`, decides with `shortcutFor` (text field: `input`, `textarea`, `select` or `contenteditable`), and calls `edits` or `useSelection`; `search` is handed to Task 13's search box (focus the element with `data-testid="search-input"` if present).
- [ ] **Step 12: Run** `npm run test:unit` and `npm run test:e2e`. Expected: PASS. Add "Undo, copy and shortcuts" to `docs/user/editor.md` (with the D12 table) and the history rules to `docs/developer/editor.md`. **Close checkpoint 12C** (commit `feat: undo, redo, copy, paste and shortcuts`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | shortcut keys | unit | Ctrl+z, Meta+z, Ctrl+Shift+Z, Ctrl+y, Ctrl+c, Meta+v, Ctrl+k, Ctrl+a, Delete, Backspace | undo, undo, redo, redo, copy, paste, search, selectAll, delete, delete | frontend/src/features/editor/model/shortcuts.test.ts :: each shortcut maps to its action |
| C2 | text fields keep their keys | unit | the same keys with `inTextField` true | only Ctrl+k gives `search`; all others `null` | frontend/src/features/editor/model/shortcuts.test.ts :: inside a text field only search is taken |
| C3 | not shortcuts | unit | `z` alone; Ctrl+Alt+z; Shift+Delete with Ctrl; `q` with Ctrl | `null` each | frontend/src/features/editor/model/shortcuts.test.ts :: other keys are not shortcuts |
| C4 | depth and future | unit | record 105 steps; undo once; record a new step | 100 kept (oldest 5 gone); future emptied by the new step | frontend/src/features/editor/model/history.test.ts :: history keeps one hundred steps and a new edit clears redo |
| C5 | invert | unit | a step with update, create, remove in that order | reversed order; update before/after swapped; create and remove swapped | frontend/src/features/editor/model/history.test.ts :: invert reverses a step |
| C6 | undo then redo | unit | record A, B; undo; undo; redo | inverse of B, inverse of A, then A again; empty history gives `null` | frontend/src/features/editor/model/history.test.ts :: undo and redo walk the history in order |
| C7 | blocked by a teammate | unit | update title `X`→`Y` recorded; state now has `Z`; a remove whose record's text was edited since; a create whose id exists | `canApply` false for each; true when the state still has `Y` | frontend/src/features/editor/model/history.test.ts :: a change someone else has touched since cannot be applied |
| C8 | copy | unit | two nodes with lines and cues, a connection between them, one to a third node; one trashed node in the selection | clip has the two live nodes, their lines and cues, only the inner connection | frontend/src/features/editor/model/clipboard.test.ts :: copy takes the nodes, their content and the connections between them |
| C9 | paste | unit | `buildPaste(clip, target, 2, counter)` | all ids new and unique, every reference remapped, x and y +80, `projectId`/`chapterId` of the target, version 0 | frontend/src/features/editor/model/clipboard.test.ts :: paste makes new records in the target chapter |
| C10 | blocked undo is skipped, not forced | unit | edits renames a node; a remote event changes the title; `undo()` | no update sent; store error `UNDO_BLOCKED`; the next undo goes further back | frontend/src/features/editor/store/edits.test.ts :: undo never overwrites a teammate's later change |
| C11 | undo and redo in the browser | e2e | rename a node, Ctrl+Z, Ctrl+Shift+Z; create a node, Ctrl+Z | old title, then new; created node gone (trashed) | e2e/editor-undo-paste.spec.ts :: undo and redo a rename and a new node |
| C12 | trash and undo brings connections back | e2e | A → B, B start; select B, Delete, Ctrl+Z, reload | B back with its edge and `Start` badge | e2e/editor-undo-paste.spec.ts :: undoing a trash brings the node back with its connections |
| C13 | multi-select drag and paste | e2e | box-select 2 connected nodes, drag, Ctrl+Z; Ctrl+C, open chapter 2, Ctrl+V twice | positions back in one undo; chapter 2 has 4 nodes, 2 edges, lines copied, second paste 40 px further | e2e/editor-undo-paste.spec.ts :: a group drag undoes in one step and paste copies across chapters |
| C14 | undo after a teammate's edit | e2e | page A renames a node; page B (same project) renames it again; A presses Ctrl+Z | A shows `Can't undo: someone else changed this since.`; both pages keep B's title | e2e/editor-undo-paste.spec.ts :: undo is refused after a teammate changed the same field |
### Probes
**Probe folder:** `tests/probes/2026-11-14-editor-core/task-12/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/model/shortcuts.ts | `if (inTextField) return action === 'search' ? action : null` | `if (false) return null` | frontend/src/features/editor/model/shortcuts.test.ts |
| B2 | frontend/src/features/editor/model/history.ts | `past.slice(-HISTORY_DEPTH)` | `past` | frontend/src/features/editor/model/history.test.ts |
| B3 | frontend/src/features/editor/model/history.ts | `sameValue(current[key], change.before[key])` | `true` | frontend/src/features/editor/model/history.test.ts, frontend/src/features/editor/store/edits.test.ts |
| B4 | frontend/src/features/editor/model/clipboard.ts | `ids.has(c.fromNodeId) && ids.has(c.toNodeId)` | `ids.has(c.fromNodeId)` | frontend/src/features/editor/model/clipboard.test.ts |
### Flow
In Firefox and Chromium: twenty mixed edits (rename, recolour, move, add and delete lines, connect, trash), undo all of them, redo half; copy a group of nodes into another project; check every shortcut, and that Ctrl+Z inside a text field undoes typing only. Record what you saw in `progress.md`.
### Evidence
The full output of `npm run check:task`, the failing run of each break, and the Flow record.
