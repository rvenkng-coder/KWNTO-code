# Task 11: Properties panel

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Checkpoint 11A tier:** local
**Depends on:** Task 10

Design 6.2 and 9c for the selected node: title, colour, screenplay-style script lines (character and text, one record per line), cues (audio, lighting, other), and for a selected connection its label. Text saves on blur and after 800 ms without typing; nothing typed is lost when the person moves on (Review Focus 3). Media is Plan 5.

**Files:**
- Create: `frontend/src/features/editor/model/characters.ts`, `frontend/src/features/editor/model/characters.test.ts`, `frontend/src/features/editor/store/pendingEdits.ts`, `frontend/src/features/editor/store/pendingEdits.test.ts`, `frontend/src/features/editor/store/useSavedText.ts`, `frontend/src/features/editor/panel/PropertiesPanel.tsx`, `NodeFields.tsx`, `ScriptLines.tsx`, `ScriptLineRow.tsx`, `Cues.tsx`, `ConnectionFields.tsx` (in `panel/`), `e2e/editor-panel.spec.ts`
- Modify: `frontend/src/features/editor/EditorScreen.tsx` (panel on the right; flush on chapter change, unmount and `pagehide`; leave warning), `docs/user/editor.md`, `docs/developer/editor.md`

**Interfaces:**
- Consumes: `editorStore` (with `saving`), `linesOf`, `cuesOf`, `insertAt`, `placeAt`, `newId` (Task 8); `useSelection`, `NODE_COLORS` (Task 10).
- Produces, `model/characters.ts`:

```ts
export const SUGGESTION_LIMIT = 8
export function characterSuggestions(lines: ScriptLine[], typed: string, limit?: number): string[]
// names used in the given lines; trimmed; empty names skipped; names equal ignoring case are one name (the first spelling seen wins);
// only names that start with `typed` ignoring case and surrounding spaces; a name equal to `typed` is left out;
// most used first, then alphabetical; at most `limit`
```

- Produces, `store/pendingEdits.ts`:

```ts
export const TEXT_SAVE_DELAY_MS = 800
export interface PendingEdits {
  set(key: string, save: () => void): void   // (re)starts the timer for key; a newer save replaces the older one
  flush(key: string): void                   // runs that key's save now, if pending
  flushAll(): void
  size(): number
}
export function createPendingEdits(schedule: (fn: () => void, ms: number) => unknown, cancel: (handle: unknown) => void): PendingEdits
export function shouldWarnOnLeave(pending: number, saving: number): boolean // true when either is above 0
```

  Keys are `${kind}:${id}:${field}`. One app-wide instance (`pendingEdits`, made with `setTimeout`/`clearTimeout`) lives in the same file.
- Produces, `store/useSavedText.ts`: `useSavedText(kind, id, field, value): [text: string, setText: (t: string) => void, flush: () => void]` (local text while typing; schedules `update(kind, id, { [field]: text })` through `pendingEdits`; adopts a remote value only while the field is not focused).
- Produces, panel behaviour: no selection shows `Select a node to edit it.`; several nodes show `<n> nodes selected` and `Move to trash`; one node shows title, the 8 colour swatches, `Make start node`, script lines, cues; a selected connection shows its label (`Choice text`) and `Delete connection`. In a line's text, Enter (without Shift) adds a line below and focuses it; Backspace in a line whose character and text are both empty deletes it and focuses the line above. Lines and cues have `Move up` and `Move down` buttons. The character field offers `characterSuggestions` over all lines of the project (a `<datalist>`).

**If interrupted:** nothing leaves state outside the working tree.

## Sized for the local model
**May touch:** `frontend/src/features/editor/model/characters.ts`, `frontend/src/features/editor/model/characters.test.ts` (exhaustive: no other file)
**Must not change:** the signature of `characterSuggestions` and `SUGGESTION_LIMIT`
Stop and report if you need to touch anything else.
**Model server:** run `npm run ping:model` first; if it says NOT answering, do not start the run (see [the runbook](../../../developer/local-model-runbook.md))
**Checkpoint given:** Checkpoint 11A only

## Checkpoint 11A: Character suggestions (local)

- [ ] **Step 1: Write the failing tests** C1 to C3.
- [ ] **Step 2: Run** `npx vitest run --project unit frontend/src/features/editor/model/characters.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `characters.ts`.** Compare lower-cased trimmed keys; leave out the typed name with `key !== typedKey` (break B1).
- [ ] **Step 4: Run** it. Expected: PASS. **Close checkpoint 11A** (commit `feat: character name suggestions`).

## Checkpoint 11B: Pending text edits

- [x] **Step 5: Write the failing tests** C4 to C6 in `pendingEdits.test.ts` (inject a fake `schedule`/`cancel` that the test fires by hand).
- [x] **Step 6: Run** them. Expected: FAIL.
- [x] **Step 7: Implement `pendingEdits.ts` and `useSavedText.ts`.** In `set`, replace an older pending save with `if (existing) cancel(existing.handle)` (break B2).
- [x] **Step 8: Run** them. Expected: PASS. **Close checkpoint 11B** (commit `feat: pending text edits flush before leaving`).

## Checkpoint 11C: The panel

- [x] **Step 9: Write the failing e2e tests** C7 to C11 in `e2e/editor-panel.spec.ts`.
- [x] **Step 10: Run** `npm run test:e2e -- e2e/editor-panel.spec.ts`. Expected: FAIL.
- [x] **Step 11: Implement the panel components.** New lines and cues get their order from `insertAt`; moves use `placeAt`; a `renumber` result sends one update per record. `EditorScreen` calls `pendingEdits.flushAll()` when the selection, chapter or project changes, on unmount and on `pagehide`, and on `beforeunload` flushes and then asks the browser to warn when `shouldWarnOnLeave(pendingEdits.size(), saving)`.
- [ ] **Step 12: Run** `npm run test:e2e`. Expected: PASS. Add "Writing the script" to `docs/user/editor.md` (lines, characters, Enter and Backspace, cues, connection labels, when text is saved) and the save path to `docs/developer/editor.md`. **Close checkpoint 11C** (commit `feat: properties panel`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | most used first, one name per spelling | unit | `ANNA` ×3, `anna` ×1, `Ben` ×2, `  ` ×1, typed `''` | `['ANNA', 'Ben']` | frontend/src/features/editor/model/characters.test.ts :: names are grouped ignoring case and ordered by use |
| C2 | prefix match | unit | typed ` an`; typed `ANNA`; typed `x` | `['ANNA']`; `[]` (exact name left out); `[]` | frontend/src/features/editor/model/characters.test.ts :: suggestions start with what was typed and leave out an exact match |
| C3 | limit and ties | unit | 12 names used once each | 8 names, alphabetical | frontend/src/features/editor/model/characters.test.ts :: at most eight suggestions, ties alphabetical |
| C4 | debounce | unit | `set(k, a)`, `set(k, b)`, fire timers | only `b` runs, once | frontend/src/features/editor/store/pendingEdits.test.ts :: a newer edit of the same field replaces the pending one |
| C5 | flush | unit | `set(k1, a)`, `set(k2, b)`, `flushAll()`; then fire timers | `a` and `b` run once each; nothing runs afterwards; `size()` 0 | frontend/src/features/editor/store/pendingEdits.test.ts :: flushAll saves every pending edit once |
| C6 | leave warning | unit | `(0, 0)`, `(1, 0)`, `(0, 2)` | `false`, `true`, `true` | frontend/src/features/editor/store/pendingEdits.test.ts :: leaving warns while anything is unsaved |
| C7 | lines with characters survive in order | e2e | title, three lines (`ANNA`/`Hello.`, `BEN`/`Hi.`, no character/`They wave.`), move the third up, reload | same title; lines in the new order; preview on the card | e2e/editor-panel.spec.ts :: script lines keep their text, characters and order |
| C8 | Enter and Backspace | e2e | Enter at the end of a line; Backspace in the new empty line | a new line appears below and has focus; then it is gone, focus on the line above; reload shows one line | e2e/editor-panel.spec.ts :: Enter adds a line and Backspace removes an empty one |
| C9 | typed text is saved when the person moves on | e2e | type in a line and click another node at once; type in the title and switch chapter tab at once; reload | both texts saved | e2e/editor-panel.spec.ts :: text typed just before moving on is saved |
| C10 | suggestions | e2e | after a line by `ANNA`, type `a` in a new line's character | `ANNA` offered in the datalist | e2e/editor-panel.spec.ts :: the character field suggests names already used |
| C11 | cues and connection labels | e2e | add a `lighting` cue; select a connection, type `Open the door`; delete another connection; reload | cue kept with its type; label shown on the edge; deleted edge gone | e2e/editor-panel.spec.ts :: cues and connection labels are saved |
### Probes
**Probe folder:** `tests/probes/2026-11-14-editor-core/task-11/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/model/characters.ts | `key !== typedKey` | `true` | frontend/src/features/editor/model/characters.test.ts |
| B2 | frontend/src/features/editor/store/pendingEdits.ts | `if (existing) cancel(existing.handle)` | `` | frontend/src/features/editor/store/pendingEdits.test.ts |
### Flow
In Firefox and Chromium: write a short scene of ten lines with three characters, reorder, add cues of each type, label connections, then type and reload at once (accept the leave warning) and check nothing was lost. Record what you saw in `progress.md`.
### Evidence
The full output of `npm run check:task`, the failing run of each break, and the Flow record.
