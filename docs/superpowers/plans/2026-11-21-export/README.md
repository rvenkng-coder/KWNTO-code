# Export (PDF, Word, JPG, PNG) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export the branch map of the current chapter (or of the whole project, one map per chapter) as a PDF, a Word file, a JPG or a PNG, made in the browser.

**Architecture:** Nothing changes on the server: an export is built from the editor store's content. A hidden, read-only React Flow (the "stage") draws one chapter with the same `NodeCard`s as the canvas, in the light look, and `html-to-image` turns it into an image. PDF (`jsPDF`) and Word (`docx`) files hold one page per chapter with the chapter's map as a high-resolution PNG. The choices (format, scope) are made in an `Export map` dialog opened from the tool strip.

**Tech Stack:** React 19, `@xyflow/react` 12, Zustand 5, TypeScript, Vitest, Playwright. **Three new dependencies** (D1): `html-to-image`, `jspdf`, `docx`.

**Spec:** [Design section 6.5](../../specs/2026-11-11-kwnto-design.md) (export) and section 6.1 (the cross-chapter tag "appears in exports"). Also binding: [engineering.md](../../../engineering.md), [security.md](../../../security.md), [testing-strategy.md](../../../testing-strategy.md). Executors read all of them.

**Standard:** test-plan-v1

## Global Constraints

- **Worktree and branch:** `feat/export` in the sibling folder `../KWNTO-code-export`, created from `main` (6421fc0). Progress is tracked in `.planning/2026-11-21-export/progress.md`.
- **Every task ends with:**

  ```
  npm run check:task -- --task docs/superpowers/plans/2026-11-21-export/task-<n>-<name>.md --base <sha at task start> --built-by strong
  ```

  Paste the full output in the report.
- **Hard rules (AGENTS.md):** only `frontend/src/backend/` imports `pocketbase` (export code needs no backend call at all); 300 lines max per file; no `any`; no dependencies beyond the three in D1; never edit a failing test; never merge.
- **Content (design 6.5):** the branching diagram only: node cards (title, header colour, markers, the three-line preview, cues, choices and cross-chapter tags exactly as the canvas shows them) and the connections inside the chapter. Trashed nodes and trashed chapters never appear. No script text beyond the card preview, no cue lists.
- **Copy, exactly:**
  - tool button `Export map`; dialog title `Export map`
  - format group `Format` with `PDF`, `Word`, `JPG`, `PNG` (default `PDF`)
  - scope group `What to export` with `Current chapter` (default) and `Whole project`
  - note shown for JPG and PNG, with `Whole project` disabled: `Images export the current chapter only.`
  - buttons `Export` and `Cancel` (and `Close` after the large-map message); status while working `Exporting…`
  - errors: `This chapter has no nodes to export.`, `This project has no nodes to export.`, `The export failed. Try again, or export one chapter at a time.`
  - after a whole-project run that left out empty chapters: `1 empty chapter was skipped.` or `N empty chapters were skipped.` (shown with the next note, then a `Close` button)
  - after a run where any map was scaled below half size: `Some maps were large, so their labels may be small in the export.`
  - document heading per chapter: `<project name> - <chapter title>`
- **File names:** `<project> - <chapter>.<ext>` for one chapter, `<project>.<ext>` for the whole project; extensions `pdf`, `docx`, `jpg`, `png` (Task 1 pins the cleaning rule).
- **Styling:** theme tokens only (the dialog); the exported map always uses the light tokens on a white (`#ffffff`) background, whatever the account theme (D4).

## Decisions

| # | Decision |
|---|---|
| D1 | Dependencies `html-to-image` (^1.11.13), `jspdf` (^4.2.1) and `docx` (^9.16.0), all MIT, the libraries design section 8 names. Recorded in `docs/decisions/0005-export-libraries.md` (Task 1). **Approving this plan approves these three and nothing else.** Each is loaded with a dynamic `import()` when an export starts, so the editor's first load does not grow. |
| D2 | The map is drawn by a hidden React Flow stage that reuses `toFlowNodes`, `toFlowEdges`, `nodeMarkers` and `NodeCard`, not by capturing the visible canvas: the canvas draws only what is in view (`onlyRenderVisibleElements`) and holds one chapter, while a whole-project export needs every chapter. Chapters are drawn one after another, never at once. |
| D3 | Size: the map is the nodes' bounds plus 40 px on each side. The pixel ratio is at most 2 and is lowered so the image's longest side is at most 8192 px and its area at most 32,000,000 px (browser canvas limits; a larger canvas comes out blank). That is how "large maps are scaled to fit one image" (design 6.5). Below a ratio of 0.5 the dialog warns that labels may be small. |
| D4 | Exports always use the light look on white, because they are printed and shared. The stage sets `data-theme="light"` on its own element (`index.css` gains that selector next to `:root`) and a `ThemeOverride` context makes `useTheme()` answer `light` inside it, so header tints come from the light palette. |
| D5 | Whole project is offered for PDF and Word only (one page per chapter, in tab order). JPG and PNG export the current chapter only: several image downloads at once are blocked by browsers and a zip would be a fourth dependency. Matches the manual checklist (M4, M5 cover both scopes; M6, M7 do not). |
| D6 | A whole-project export skips chapters with no live nodes; if none has any, it is refused with `This project has no nodes to export.` A current-chapter export of an empty chapter is refused with `This chapter has no nodes to export.` No empty file is ever downloaded. |
| D7 | PDF: A4, unit `pt`, one page per chapter, landscape when the map is at least as wide as it is high, else portrait; margin 36 pt; the heading at 14 pt; the image fitted below it, keeping its aspect. Word: A4 landscape, margins 720 twips, a Heading 1 per chapter and the image fitted into 1026 × 640 px, a page break between chapters. The bytes come from `doc.output('arraybuffer')` (jsPDF) and `Packer.toBase64String` (docx), so the same code runs in the Node unit tests and the browser. |
| D8 | Export reads only the store, so it works offline and never writes: no edit, no undo step, no change to the visible canvas. |

## Tasks

| Task | What | Status |
|---|---|---|
| [1](task-1-export-plan.md) | Decision record, dependencies, the pure export rules (scope, file names, scale, fit) | done |
| [2](task-2-documents.md) | PDF and Word builders | done |
| [3](task-3-stage-dialog.md) | The light theme override, the stage, the dialog and every format (current chapter) | done |
| [4](task-4-documents-closeout.md) | Whole project, large maps, docs, closeout | done |

## Review Focus

Likely to bite a person, most likely first. Each line has a test in the owning task.

1. **An empty chapter or project** (no nodes, or all of them trashed) downloads a blank image or an empty PDF. Must be refused with the D6 message and nothing downloaded (Task 1 C1, Task 3 C7, Task 4 C4).
2. **A large map** (hundreds of nodes spread wide) exceeds the browser canvas limit and comes out blank, or is silently unreadable. The ratio is capped (D3) and the dialog warns (Task 1 C3, Task 4 C5).
3. **A dark-theme account** gets a dark, unprintable export, or dark-palette header tints on white. The export is light whatever the theme (Task 3 C6).
4. **A project or chapter name with `/`, `:`, quotes, emoji, only spaces or 300 characters** gives a broken or empty file name. Cleaned by the rule in Task 1 (Task 1 C2).
5. **Exporting disturbs the editor**: the visible canvas moves, a selection changes, or an undo step appears. Export only reads (D8) (Task 3 C8).

## Files

| Path | Role |
|---|---|
| `docs/decisions/0005-export-libraries.md` | The dependency record (D1) |
| `frontend/src/features/editor/export/exportPlan.ts` | Pure rules: types, scope, file names, pixel ratio, fit |
| `frontend/src/features/editor/export/documents.ts` | `buildPdf`, `buildDocx`, `dataUrlBytes` |
| `frontend/src/features/editor/export/ExportStage.tsx` | The hidden React Flow that draws one chapter and captures it |
| `frontend/src/features/editor/export/ExportDialog.tsx`, `useExportRun.ts`, `download.ts` | The dialog, the run over chapters, the file download |
| `frontend/src/features/shell/theme.ts`, `frontend/src/index.css` | `ThemeOverride`; the `[data-theme="light"]` selector |
| `frontend/src/features/editor/canvas/ToolStrip.tsx`, `icons.tsx` | The `Export map` button and its icon |
| `tests/helpers/zip-entry.ts` | Reads one file out of a `.docx` in tests (unit and e2e) |
| `e2e/editor-export.spec.ts`, `e2e/editor-export-project.spec.ts`, `e2e/helpers/export.ts` | The end-to-end tests |
