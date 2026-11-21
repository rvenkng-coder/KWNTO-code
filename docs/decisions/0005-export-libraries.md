# 0005: Export libraries

**Date:** 2026-11-21
**Status:** accepted with the export plan (Plan 8)

Export (PDF, Word, JPG, PNG) adds three npm dependencies, the libraries design section 8 names. Approving the plan approves these three and nothing else.

| Package | Version range | Used by | What for | Licence |
|---|---|---|---|---|
| `html-to-image` | `^1.11.13` | `ExportStage.tsx` | Turns the hidden map (the stage) into a PNG or JPG data URL | MIT |
| `jspdf` | `^4.2.1` | `documents.ts` | Builds the PDF: one A4 page per chapter with the map image | MIT |
| `docx` | `^9.16.0` | `documents.ts` | Builds the Word file: a heading and the map image per chapter | MIT |

## Why these

Design section 8 names them. All three run in the browser, so nothing changes on the server, and the document builders also run in Node, so the unit tests exercise the real libraries.

## Loading

Each is loaded with a dynamic `import()` when an export starts, so the editor's first load does not grow.

## How to bump

1. Read the changelog of the new version.
2. `npm run test:unit`.
3. `npm run test:e2e -- e2e/editor-export.spec.ts`.
4. Manual checks M4 to M7 of the [test plan](../test-plan.md).
