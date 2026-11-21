# Task 2: PDF and Word builders

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Task 1

**Files:**
- Create: `frontend/src/features/editor/export/documents.ts`, `frontend/src/features/editor/export/documents.test.ts`, `tests/helpers/zip-entry.ts`

**Interfaces:**
- Consumes: `MapImage`, `fitInto` (Task 1); `jspdf`, `docx` (D1).
- Produces in `documents.ts`:
  - `dataUrlBytes(dataUrl: string): Uint8Array` (base64 data URLs only; anything else throws `Error('Not a data URL')`)
  - `buildPdf(projectName: string, maps: MapImage[]): Promise<Blob>` (type `application/pdf`)
  - `buildDocx(projectName: string, maps: MapImage[]): Promise<Blob>` (type `application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
  - Both reject with `Error('Nothing to export.')` for an empty list. Each map's `dataUrl` is a PNG.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 2A: the builders

- [ ] **Step 1: Write failing tests** `documents.test.ts` (C1 to C4). Fixture: the 1 × 1 PNG `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==` with the declared `width` and `height` each case gives. Read the PDF as text (jsPDF writes it uncompressed). For Word, write `tests/helpers/zip-entry.ts` with `zipEntryText(bytes: Uint8Array, name: string): string` (Task 4's e2e reuses it): find the end-of-central-directory record, walk the central directory to the entry, read its local header and `inflateRawSync` from `node:zlib` (no new dependency); a missing entry throws `Error('No zip entry <name>')`.
- [ ] **Step 2: Run, expect FAIL**: `npx vitest run frontend/src/features/editor/export/documents.test.ts`.
- [ ] **Step 3: Implement** `documents.ts` with the layout of D7. Load the libraries with `await import('jspdf')` and `await import('docx')` under a `PERF:` comment (What, Why, Trade-off: D1). Write these lines exactly (breaks target them): `const orientation = map.width >= map.height ? 'landscape' : 'portrait'`, `if (i > 0) doc.addPage('a4', orientation)`, `orientation: PageOrientation.LANDSCAPE`, `pageBreakBefore: i > 0`. Constants: `PDF_MARGIN = 36`, `PDF_HEADING = 14`, `WORD_IMAGE_BOX = { width: 1026, height: 640 }`. The PDF heading is drawn with `doc.text` (a heading outside Latin-1 is drawn into a picture with the browser's fonts instead, since the built-in font cannot draw it; an empty title reads `Untitled`); the image with `doc.addImage(map.dataUrl, 'PNG', x, y, w, h)` at the size `fitInto` gives for the space under the heading. Word: one section, page `size: { orientation: PageOrientation.LANDSCAPE }`, margins 720 on every side; per map a `HeadingLevel.HEADING_1` paragraph with the heading text and `pageBreakBefore: i > 0`, then a paragraph with an `ImageRun` (`type: 'png'`, `data: dataUrlBytes(map.dataUrl)`, `transformation` from `fitInto(map.width, map.height, WORD_IMAGE_BOX)`). Bytes from `Packer.toBase64String`, decoded with `atob`.
- [ ] **Step 4: Run, expect PASS**: `npx vitest run frontend/src/features/editor/export` and `npm run typecheck`. Close the checkpoint (one commit) `feat: PDF and Word builders for the map`.

## Test plan

### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | data URL bytes | unit | the fixture; `'https://x.example/a.png'`; `'data:image/png,abc'` (not base64) | bytes start `0x89 0x50 0x4e 0x47`; both others throw `Not a data URL` | frontend/src/features/editor/export/documents.test.ts :: data URLs become bytes and anything else is refused |
| C2 | one PDF page per chapter, oriented by its map | unit | `buildPdf('Story', [wide 2000×1000 'Chapter 1', tall 800×1600 'Chapter 2', wide 1200×900 'Chapter 3'])` | type `application/pdf`; text starts `%PDF-`; `/\/Type \/Page\b(?!s)/g` matches 3 times; the `/MediaBox` values are landscape, portrait, landscape (width > height, width < height, width > height); text contains `(Story - Chapter 1)`, `(Story - Chapter 2)`, `(Story - Chapter 3)` | frontend/src/features/editor/export/documents.test.ts :: the PDF has one page per chapter with its heading and orientation |
| C3 | Word file: landscape, a heading and an image per chapter | unit | `buildDocx('Story', [three maps as in C2])` | type is the Word type; bytes start `PK`; `word/document.xml` contains `w:orient="landscape"`, `Story - Chapter 1`, `Story - Chapter 2`, `Story - Chapter 3`, `<pic:pic` 3 times and `<w:pageBreakBefore/>` 2 times | frontend/src/features/editor/export/documents.test.ts :: the Word file has a heading and an image per chapter on landscape pages |
| C4 | nothing to export | unit | `buildPdf('Story', [])`, `buildDocx('Story', [])` | both reject with `Nothing to export.` | frontend/src/features/editor/export/documents.test.ts :: an empty list is refused |

### Probes
**Probe folder:** `tests/probes/2026-11-21-export/task-2/`

### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/export/documents.ts | `const orientation = map.width >= map.height ? 'landscape' : 'portrait'` | `const orientation = map.width >= map.height ? 'portrait' : 'landscape'` | frontend/src/features/editor/export/documents.test.ts |
| B2 | frontend/src/features/editor/export/documents.ts | `if (i > 0) doc.addPage('a4', orientation)` | `if (i > 1) doc.addPage('a4', orientation)` | frontend/src/features/editor/export/documents.test.ts |
| B3 | frontend/src/features/editor/export/documents.ts | `orientation: PageOrientation.LANDSCAPE` | `orientation: PageOrientation.PORTRAIT` | frontend/src/features/editor/export/documents.test.ts |
| B4 | frontend/src/features/editor/export/documents.ts | `pageBreakBefore: i > 0` | `pageBreakBefore: false` | frontend/src/features/editor/export/documents.test.ts |

### Flow
none

### Evidence
The full output of `npm run check:task` and the failing run of each break.
