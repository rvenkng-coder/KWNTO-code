# Task 3: The stage, the dialog and every format

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Task 1 and Task 2

**Files:**
- Create: `frontend/src/features/editor/export/ExportStage.tsx`, `ExportDialog.tsx`, `useExportRun.ts`, `download.ts` (all in `frontend/src/features/editor/export/`), `e2e/editor-export.spec.ts`, `e2e/helpers/export.ts`
- Modify: `frontend/src/index.css` (`:root` becomes `:root, [data-theme="light"]`), `frontend/src/features/shell/theme.ts` (`ThemeOverride`), `frontend/src/features/editor/canvas/ToolStrip.tsx`, `frontend/src/features/editor/canvas/icons.tsx`, `frontend/src/features/editor/EditorScreen.tsx` (passes the project name to `ToolStrip`)

**Interfaces:**
- Consumes: everything `exportPlan.ts` produces (Task 1); `buildPdf`, `buildDocx`, `dataUrlBytes` (Task 2); `toFlowNodes`, `toFlowEdges` (`model/flow.ts`), `nodeMarkers` (`model/markers.ts`), `NodeCard` (`canvas/NodeCard.tsx`), `useEditor` (`store/editorStore.ts`).
- Produces in `theme.ts`: `ThemeOverride: React.Context<Theme | null>` (default `null`); `useTheme()` returns the override when one is set, else the current theme.
- Produces in `ExportStage.tsx`: `ExportStage({ chapterId, kind, onImage, onError }: { chapterId: string; kind: 'png' | 'jpeg'; onImage(img: MapImage): void; onError(): void })`, a portal on `document.body` with `data-testid="export-stage"`, `aria-hidden="true"`, `data-theme="light"`, fixed at `left: -20000px; top: 0`, 1600 × 1000 px.
- Produces in `download.ts`: `downloadBlob(name: string, blob: Blob): void` (object URL, an `<a download>` click, revoke after 10 s).
- Produces in `useExportRun.ts`: `useExportRun(projectName: string, activeChapterId: string | null)` returning `{ status: 'idle' | 'working' | 'error' | 'small'; message: string | null; stage: { chapterId: string; kind: 'png' | 'jpeg' } | null; start(format: ExportFormat, scope: ExportScope): void; onImage(img: MapImage): void; onError(): void }`.
- Produces in `ExportDialog.tsx`: `ExportDialog({ projectName, chapterId, onClose }: { projectName: string; chapterId: string | null; onClose(): void })`, `role="dialog"`, `aria-modal="true"`, labelled `Export map`.
- `ToolStrip` gains a `projectName: string` prop and a `ToolButton` `icon="export"`, `name="Export map"`, disabled while `chapterId` is `null`.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 3A: the end-to-end tests

- [ ] **Step 1: Write failing tests** `e2e/editor-export.spec.ts` (C1 to C8), with the setup of `e2e/editor-links.spec.ts` (`ownerWithProject`, `readyCanvas`, `addNodeAt`, `connectNodes`). Put the shared steps in `e2e/helpers/export.ts`: `exportMap(page, format: 'PDF' | 'Word' | 'JPG' | 'PNG', scope: 'Current chapter' | 'Whole project'): Promise<Download>` (opens the dialog, picks, clicks `Export`, waits for the download), `downloadBytes(d: Download): Promise<Buffer>`, `pngSize(bytes: Buffer): { width: number; height: number }` (big-endian at bytes 16 and 20), and `cornerPixel(page, bytes, mime): Promise<[number, number, number]>` (draws the image on a canvas in the page and reads pixel (2, 2)).
- [ ] **Step 2: Run, expect FAIL**: `npm run test:e2e -- e2e/editor-export.spec.ts`.

## Checkpoint 3B: theme override, stage, run, dialog

- [ ] **Step 1: Implement the light override**: the `index.css` selector and `ThemeOverride` in `theme.ts`.
- [ ] **Step 2: Implement `ExportStage`**: a `ReactFlowProvider` and a `ReactFlow` with the chapter's `toFlowNodes(content, chapterId, nodeMarkers(content))` and `toFlowEdges(content, chapterId)` from the store, `nodeTypes = { card: NodeCard }` defined at module level, nothing draggable, connectable or selectable, no `onlyRenderVisibleElements`, no background, minimap or controls, wrapped in `<ThemeOverride.Provider value="light">`. When `useNodesInitialized()` is true, wait for `document.fonts.ready` and two animation frames, then: bounds from `getNodesBounds(nodes)` grown by `MAP_PADDING`; `ratio = exportPixelRatio(w, h)`; capture the `.react-flow__viewport` element with `toPng` or `toJpeg` from `html-to-image` (dynamic import, D1) with `{ backgroundColor: '#ffffff', width: w, height: h, pixelRatio: ratio, style: { width: `${w}px`, height: `${h}px`, transform: `translate(${-x}px, ${-y}px) scale(1)` } }` (and `quality: 0.92` for JPEG); call `onImage({ chapterTitle, dataUrl, width: Math.round(w * ratio), height: Math.round(h * ratio), small: isSmallText(ratio) })`. Any throw calls `onError()`.
- [ ] **Step 3: Implement `useExportRun`**: `start` runs `exportChapters`; a refusal sets `status: 'error'` with its message. Otherwise it steps through the chapters one at a time (`stage` names the current one; kind `jpeg` for `jpg`, else `png`), collecting images. After the last, it builds the file (`png`, `jpg`: the single image's bytes from `dataUrlBytes` as a `Blob` of `image/png` or `image/jpeg`; `pdf`: `buildPdf`; `docx`: `buildDocx`) and calls `downloadBlob(exportFileName(projectName, scope === 'chapter' ? chapter.title : null, format), blob)`. Then `status` is `'small'` (message `Some maps were large, so their labels may be small in the export.`) when any image was `small`, else `'idle'` and the dialog closes. Any failure sets `status: 'error'` with `The export failed. Try again, or export one chapter at a time.` The run never calls `edits` or the backend (D8).
- [ ] **Step 4: Implement `ExportDialog`** with the router's copy: two `fieldset`s with `legend` `Format` and `What to export` and radio inputs; picking JPG or PNG selects `Current chapter`, disables `Whole project` and shows `Images export the current chapter only.`; while working the status `Exporting…` (`role="status"`) shows and every control is disabled; errors in `role="alert"` text in the danger colour; after `'small'` the message shows with a `Close` button. Escape and `Cancel` close it except while working. Focus starts on the checked format and returns to the `Export map` button on close. Drawn in a portal on `document.body` over a backdrop, styled with theme tokens. It renders `<ExportStage key={stage.chapterId} … />` while `stage` is set.
- [ ] **Step 5: Wire the tool strip**: an `export` icon in `icons.tsx` (a stroke arrow out of a tray, 16 px, like the others); the button opens the dialog; `EditorScreen` passes `projectName`.
- [ ] **Step 6: Run, expect PASS**: `npm run test:e2e -- e2e/editor-export.spec.ts e2e/editor-tools.spec.ts e2e/editor-look.spec.ts`, `npm run test:unit`, `npm run typecheck`, `npm run lint`. Close the checkpoint (one commit) `feat: export the map as PDF, Word, JPG or PNG`.

## Test plan

### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | the tool and the dialog | e2e | click `Export map` in the tool strip | a dialog named `Export map` with the `Format` radios (PDF checked) and `What to export` radios (Current chapter checked); Escape closes it and focus is back on `Export map` | e2e/editor-export.spec.ts :: the Export map dialog opens from the tool strip and closes on Escape |
| C2 | PNG of the current chapter | e2e | project `Story`, two connected nodes in `Chapter 1`; export PNG | download named `Story - Chapter 1.png`; bytes start `89 50 4E 47`; `pngSize` width and height both above 200 | e2e/editor-export.spec.ts :: a PNG of the current chapter downloads with its name |
| C3 | JPG of the current chapter | e2e | as C2; export JPG | download named `Story - Chapter 1.jpg`; bytes start `FF D8 FF` | e2e/editor-export.spec.ts :: a JPG of the current chapter downloads |
| C4 | images are one chapter only | e2e | open the dialog, pick JPG, then PNG | `Whole project` is disabled and `Current chapter` checked; the text `Images export the current chapter only.` shows; picking PDF enables `Whole project` again | e2e/editor-export.spec.ts :: images export the current chapter only |
| C5 | PDF and Word of the current chapter | e2e | as C2; export PDF, then Word | `Story - Chapter 1.pdf` starting `%PDF-` with one `/Type /Page` entry and the text `Story - Chapter 1`; `Story - Chapter 1.docx` starting `PK` | e2e/editor-export.spec.ts :: PDF and Word files of the current chapter download |
| C6 | the export is light in a dark account | e2e | switch the account to dark (`html[data-theme="dark"]`); export PNG | `cornerPixel` is `[255, 255, 255]`; the page is still dark afterwards | e2e/editor-export.spec.ts :: a dark account still gets a light map on white |
| C7 | an empty chapter is refused | e2e | a new project, no nodes; export PNG | the alert `This chapter has no nodes to export.`; no download event within 2 s | e2e/editor-export.spec.ts :: an empty chapter is refused and nothing downloads |
| C8 | export leaves the editor alone | e2e | two nodes, one selected; record its position and every non-GET request to `/api/`; export PNG | same position and the card still selected; no non-GET request was sent; `export-stage` is gone from the page; the canvas shows 2 nodes | e2e/editor-export.spec.ts :: exporting changes nothing in the editor |

### Probes
**Probe folder:** `tests/probes/2026-11-21-export/task-3/`

### Breaks
none

### Flow
none (the manual items M4 to M7 are Task 4's Flow)

### Evidence
The full output of `npm run check:task` and of the e2e run.
