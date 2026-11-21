# Task 1: Decision record, dependencies and the pure export rules

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** none

**Files:**
- Create: `docs/decisions/0005-export-libraries.md`, `frontend/src/features/editor/export/exportPlan.ts`, `frontend/src/features/editor/export/exportPlan.test.ts`
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Consumes: `ContentState`, `liveChapters`, `liveNodes` from `frontend/src/features/editor/model/state.ts`; `Chapter` from `frontend/src/backend`.
- Produces in `exportPlan.ts`:
  - `type ExportFormat = 'pdf' | 'docx' | 'jpg' | 'png'` and `type ExportScope = 'chapter' | 'project'`
  - `interface MapImage { chapterTitle: string; dataUrl: string; width: number; height: number; small: boolean }` (width and height in image pixels; `small` when the ratio was below 0.5)
  - `scopesFor(format: ExportFormat): ExportScope[]`: `['chapter', 'project']` for `pdf` and `docx`, `['chapter']` for `jpg` and `png` (D5)
  - `exportChapters(s: ContentState, scope: ExportScope, activeChapterId: string | null): { ok: true; chapters: Chapter[] } | { ok: false; message: string }` (D6; tab order from `liveChapters`)
  - `exportFileName(projectName: string, chapterTitle: string | null, format: ExportFormat): string`
  - `exportPixelRatio(width: number, height: number): number` and `isSmallText(ratio: number): boolean` (D3)
  - `fitInto(width: number, height: number, box: { width: number; height: number }): { width: number; height: number }` (the largest size with the same aspect inside the box; may scale up)
  - `MAP_PADDING = 40`

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 1A: decision record and dependencies

- [ ] **Step 1: Write** `docs/decisions/0005-export-libraries.md` in the shape of `0004-deployment-images.md`: a table with package, version range, used by (`documents.ts` or `ExportStage.tsx`), what for, licence (all MIT); why each (design section 8 names them); loaded by dynamic `import()` (D1); how to bump (read the changelog, `npm run test:unit`, `npm run test:e2e -- e2e/editor-export.spec.ts`, manual M4 to M7). Status `accepted with the export plan (Plan 8)`.
- [ ] **Step 2: Install**: `npm install html-to-image@^1.11.13 jspdf@^4.2.1 docx@^9.16.0`. Then `npm audit --omit=dev`: a high or critical advisory in one of the three, or in what they pull in, means stop and report.
- [ ] **Step 3: Verify**: `npm run lint` and `npm run typecheck` pass. Commit `docs: decision record for the export libraries` with both package files.

## Checkpoint 1B: the pure rules

- [ ] **Step 1: Write failing tests** `exportPlan.test.ts` (C1 to C4), building states with `fromContent` and the fixtures in `model/fixtures.ts`.
- [ ] **Step 2: Run, expect FAIL**: `npx vitest run frontend/src/features/editor/export/exportPlan.test.ts`.
- [ ] **Step 3: Implement** `exportPlan.ts`. Write these lines exactly (breaks target them): `const MAX_SIDE = 8192`, `const MAX_AREA = 32_000_000`, `const MAX_RATIO = 2`, `const UNSAFE = /[\\/:*?"<>|]/g`, and in `exportChapters` the filter `.filter((c) => liveNodes(s, c.id).length > 0)`.
  - `exportPixelRatio`: `Math.min(MAX_RATIO, MAX_SIDE / Math.max(width, height), Math.sqrt(MAX_AREA / (width * height)))`; a zero or negative size gives `MAX_RATIO`.
  - `isSmallText(ratio)` is `ratio < 0.5`.
  - `exportFileName`, for each part in order: collapse whitespace runs (`\s+`, tabs and newlines included) to one space, drop the control characters left (code below 32, filtered by char code, not a regex, so `no-control-regex` stays quiet), replace `UNSAFE` matches with `-`, trim, strip leading and trailing dots; each part is cut to 100 characters (by code point, so an emoji is never split); an empty project part becomes `KWNTO map`, an empty chapter part `Untitled`; join with ` - `; add `.` and the format.
- [ ] **Step 4: Run, expect PASS. Close the checkpoint (one commit)** `feat: the pure export rules`.

## Test plan

### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | chapters to export | unit | three chapters in tab order A, B (no nodes), C (one live node and one trashed); a trashed chapter D with a node; A has two live nodes. Calls: `('chapter', A)`, `('chapter', B)`, `('project', A)`; a state whose only node is trashed with `('project', null)`; `('chapter', null)` | `[A]`; `{ ok: false, message: 'This chapter has no nodes to export.' }`; `[A, C]` (B skipped, D never); `{ ok: false, message: 'This project has no nodes to export.' }`; `{ ok: false, message: 'This chapter has no nodes to export.' }` | frontend/src/features/editor/export/exportPlan.test.ts :: the chapters to export skip empty and trashed chapters |
| C2 | file names are safe | unit | `('Story', 'Chapter 1', 'png')`; `('My/Story', 'Ch: "1"', 'pdf')`; `('  ', null, 'docx')`; `('Story', '   ', 'jpg')`; `('..Story..', null, 'pdf')`; `('Tab\tand\nline', null, 'png')`; a 300-character project name of `é` and `🎭` | `Story - Chapter 1.png`; `My-Story - Ch- -1-.pdf`; `KWNTO map.docx`; `Story - Untitled.jpg`; `Story.pdf`; `Tab and line.png`; the name part is 100 code points and ends with a whole character | frontend/src/features/editor/export/exportPlan.test.ts :: file names are cleaned |
| C3 | pixel ratio and the small-text flag | unit | `(800, 600)`; `(8192, 100)`; `(100000, 500)`; `(6000, 6000)`; `(0, 0)`; `isSmallText(0.49)`, `isSmallText(0.5)` | `2`; `1`; `0.08192`, and `100000 * r <= 8192`; a ratio below 1 with `(6000 r)^2 <= 32000001`; `2`; `true`, `false` | frontend/src/features/editor/export/exportPlan.test.ts :: the pixel ratio keeps the image inside the canvas limits |
| C4 | scopes and fit | unit | `scopesFor` for each format; `fitInto(2000, 1000, {width: 500, height: 500})`; `fitInto(100, 400, {width: 500, height: 500})` | pdf and docx `['chapter', 'project']`, jpg and png `['chapter']`; `{ width: 500, height: 250 }`; `{ width: 125, height: 500 }` | frontend/src/features/editor/export/exportPlan.test.ts :: scopes per format and fitting into a box |

### Probes
**Probe folder:** `tests/probes/2026-11-21-export/task-1/`

### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/export/exportPlan.ts | `const MAX_SIDE = 8192` | `const MAX_SIDE = 81920` | frontend/src/features/editor/export/exportPlan.test.ts |
| B2 | frontend/src/features/editor/export/exportPlan.ts | `const MAX_AREA = 32_000_000` | `const MAX_AREA = 320_000_000` | frontend/src/features/editor/export/exportPlan.test.ts |
| B3 | frontend/src/features/editor/export/exportPlan.ts | `const UNSAFE = /[\\/:*?"<>\|]/g` | `const UNSAFE = /[\\:*?"<>\|]/g` | frontend/src/features/editor/export/exportPlan.test.ts |
| B4 | frontend/src/features/editor/export/exportPlan.ts | `.filter((c) => liveNodes(s, c.id).length > 0)` | `.filter(() => true)` | frontend/src/features/editor/export/exportPlan.test.ts |

### Flow
none

### Evidence
The full output of `npm run check:task`, the `npm audit --omit=dev` output, and the failing run of each break.
