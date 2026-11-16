# Task 13: Search and cross-chapter links

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Checkpoint 13A tier:** local
**Depends on:** Tasks 10 and 12 (`edits`)

Design 6.1: "Header search jumps to a node by title, across all chapters", and "Link to a node in another chapter" with a searchable picker; the link shows as a tag on the source node (`→ Chapter 2: The Door`) that jumps to the target when clicked.

**Files:**
- Create: `frontend/src/features/editor/model/search.ts`, `frontend/src/features/editor/model/search.test.ts`, `frontend/src/features/editor/search/SearchBox.tsx`, `frontend/src/features/editor/search/NodePicker.tsx`, `frontend/src/features/editor/search/jump.ts`, `frontend/src/features/editor/canvas/useCanvasFocus.ts`, `e2e/editor-search-links.spec.ts`
- Modify: `frontend/src/features/shell/AppShell.tsx` (search slot shows `SearchBox` while a project is open), `frontend/src/features/editor/canvas/NodeCard.tsx` (tags), `frontend/src/features/editor/canvas/Canvas.tsx` (centres on a focus request), `frontend/src/features/editor/panel/NodeFields.tsx` (link action and the list of the node's cross-chapter links with Remove), `docs/user/editor.md`

**Interfaces:**
- Consumes: `ContentState`, `liveChapters`, `liveNodes` (Task 8); `crossLinksOf`, `CrossLink`, `useSelection` (Task 10); `edits` (Task 12); `useTabsView` (Task 9); `navigate` (Task 1).
- Produces, `model/search.ts`:

```ts
export interface SearchHit { nodeId: string; chapterId: string; chapterTitle: string; title: string }
export const SEARCH_LIMIT = 20
export function normalizeTitle(text: string): string
// text.normalize('NFD'), combining marks (U+0300 to U+036F) removed, lower-cased, trimmed, runs of whitespace made one space
export function searchNodes(s: ContentState, query: string, options?: { limit?: number; excludeChapterId?: string }): SearchHit[]
// live nodes whose normalized title contains the normalized query; titles that start with it first, then the others;
// inside each group by chapter order (liveChapters), then title, then id; empty or blank query -> []
```

- Produces, `canvas/useCanvasFocus.ts`: zustand store `{ request: { nodeId: string; nonce: number } | null; focus(nodeId: string): void }`; `Canvas` centres on the node (`setCenter`, current zoom) when `request` changes and the node is in the shown chapter.
- Produces, `search/jump.ts`: `jumpToNode(nodeId: string): void` (reopens the chapter's tab with `useTabsView.open`, navigates to `#/project/<p>/chapter/<c>`, selects the node, requests focus).
- Produces: `SearchBox` (`data-testid="search-input"`, results as a list of `<button>`s `Title · Chapter`, arrow keys and Enter, Escape closes); `NodePicker` (the same search with `excludeChapterId` set to the source node's chapter; choosing a node creates the connection through `edits.create('connections', ...)`, label empty); tags on node cards are buttons (`data-testid="cross-link"`) that call `jumpToNode`.

**If interrupted:** nothing leaves state outside the working tree.

## Sized for the local model
**May touch:** `frontend/src/features/editor/model/search.ts`, `frontend/src/features/editor/model/search.test.ts` (exhaustive: no other file)
**Must not change:** the `SearchHit` type, `SEARCH_LIMIT`, and the signatures of `normalizeTitle` and `searchNodes`
Stop and report if you need to touch anything else.
**Model server:** run `npm run ping:model` first; if it says NOT answering, do not start the run (see [the runbook](../../../developer/local-model-runbook.md))
**Checkpoint given:** Checkpoint 13A only

## Checkpoint 13A: Search (local)

- [x] **Step 1: Write the failing tests** C1 to C4 (build states with `fromContent`).
- [x] **Step 2: Run** `npx vitest run --project unit frontend/src/features/editor/model/search.test.ts`. Expected: FAIL.
- [x] **Step 3: Implement `search.ts`.** Start `normalizeTitle` with `text.normalize('NFD')` and mark the group with `const starts = title.startsWith(q)` (breaks B1, B2).
- [x] **Step 4: Run** it. Expected: PASS. **Close checkpoint 13A** (commit `feat: node search`).

## Checkpoint 13B: Search box, picker, tags and jumps

- [ ] **Step 5: Write the failing e2e tests** C5 to C7 in `e2e/editor-search-links.spec.ts`.
- [ ] **Step 6: Run** `npm run test:e2e -- e2e/editor-search-links.spec.ts`. Expected: FAIL.
- [ ] **Step 7: Implement** `useCanvasFocus`, `jump.ts`, `SearchBox`, `NodePicker`, the tags in `NodeCard` and the panel's link action and list.
- [ ] **Step 8: Run** `npm run test:e2e`. Expected: PASS. Add "Search and links between chapters" to `docs/user/editor.md`. **Close checkpoint 13B** (commit `feat: search and cross-chapter links`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | case, accents and spaces | unit | titles `Café Scene`, `THE  door`; queries `cafe`, ` the door `, `SCÈNE` | `Café Scene`, `THE  door`, `Café Scene` | frontend/src/features/editor/model/search.test.ts :: search ignores case, accents and extra spaces |
| C2 | order | unit | `Door` in chapter 2, `The Door` in chapter 1, `Doorway` in chapter 1; query `door` | `Doorway`, `Door`, `The Door` (starts-with group by chapter order and title, then contains) | frontend/src/features/editor/model/search.test.ts :: titles that start with the query come first |
| C3 | what is never found | unit | trashed node, node in a trashed chapter, untitled node; blank query `'  '` | none found; `[]` | frontend/src/features/editor/model/search.test.ts :: trashed and untitled nodes and blank queries find nothing |
| C4 | limit and exclusion | unit | 30 matches; `excludeChapterId` of chapter 1 | 20 hits; no hit from chapter 1 | frontend/src/features/editor/model/search.test.ts :: results are limited and a chapter can be left out |
| C5 | search jumps across chapters | e2e | in chapter 1, type `door` and press Enter on `The Door` in chapter 2 (its tab closed) | chapter 2 tab open and active, node selected and in view | e2e/editor-search-links.spec.ts :: search jumps to a node in another chapter |
| C6 | link, tag and jump | e2e | on node A (chapter 1) link to `The Door` (chapter 2); click the tag; reload | tag `→ Chapter 2: The Door` on A; click opens chapter 2 with the target selected; target has no `Unreachable` badge; after reload the tag is still there | e2e/editor-search-links.spec.ts :: a cross-chapter link shows a tag that jumps to its target |
| C7 | trashed target leaves no tag | e2e | trash `The Door`; then undo | tag gone and A shows `End`; after undo the tag is back | e2e/editor-search-links.spec.ts :: trashing a link target removes its tag until undone |
### Probes
**Probe folder:** `tests/probes/2026-11-14-editor-core/task-13/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/model/search.ts | `text.normalize('NFD')` | `text.normalize('NFC')` | frontend/src/features/editor/model/search.test.ts |
| B2 | frontend/src/features/editor/model/search.ts | `const starts = title.startsWith(q)` | `const starts = false` | frontend/src/features/editor/model/search.test.ts |
### Flow
In Firefox and Chromium, in a project with three chapters: search by part of a title with and without accents, jump with the keyboard only, link nodes across chapters and follow the tags both ways. Record what you saw in `progress.md`.
### Evidence
The full output of `npm run check:task`, the failing run of each break, and the Flow record.
