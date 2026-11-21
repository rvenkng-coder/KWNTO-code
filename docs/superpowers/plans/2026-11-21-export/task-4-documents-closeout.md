# Task 4: Whole project, large maps, docs and closeout

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Task 3

**Files:**
- Create: `e2e/editor-export-project.spec.ts`
- Modify: `docs/user/editor.md`, `docs/test-plan.md`, `docs/superpowers/plans/README.md`, `docs/superpowers/plans/2026-11-21-export/README.md` (task statuses), `.planning/2026-11-21-export/progress.md`; any file under `frontend/src/features/editor/export/` a failing case here shows is wrong (fix it, never the test)

**Interfaces:**
- Consumes: the dialog and `e2e/helpers/export.ts` (Task 3); `zipEntryText` from `tests/helpers/zip-entry.ts` (Task 2); the admin helpers in `e2e/helpers/admin.ts` and the seeding pattern of `e2e/helpers/seed.ts`.
- Produces: none

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 4A: whole project and large maps

- [ ] **Step 1: Write the tests** `e2e/editor-export-project.spec.ts` (C1 to C5). Chapters are added with the `Add chapter` button as in `e2e/editor-chapters.spec.ts`; the far node of C5 gets `x: 40000` through the admin API (as `seed.ts` writes records), then the page is reloaded.
- [ ] **Step 2: Run**: `npm run test:e2e -- e2e/editor-export-project.spec.ts`. These cover code Task 3 built, so they may already pass; any that fail are fixed in `frontend/src/features/editor/export/` (never in the test), with the failing run kept for the report.
- [ ] **Step 3: Run, expect PASS**: `npm run test:e2e -- e2e/editor-export.spec.ts e2e/editor-export-project.spec.ts`. Commit `test: whole-project and large-map exports`.

## Checkpoint 4B: docs and closeout

- [ ] **Step 1: Update the docs.**
  - `docs/user/editor.md`: an "Exporting the map" section after "Links and other material": the button, the four formats, current chapter or whole project (PDF and Word only), what is in it (the cards and connections, not the script), always light on white, empty chapters skipped, the large-map warning, works offline.
  - `docs/test-plan.md`: the Export row becomes `covered` for unit and e2e with the four test files, manual M4 to M7 still `open`.
  - `docs/superpowers/plans/README.md`: row 8 links this plan with status `awaiting developer review`; the Plan 8 outline says "detailed plan" with the link.
  - The task table in this plan's README: every task `done`.
- [ ] **Step 2: Run the whole suite**: `npm test`. Close the checkpoint (one commit) `docs: export guide, test plan and roadmap`, and add the progress rows.

## Test plan

### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | whole-project PDF skips empty chapters | e2e | project `Story`: `Chapter 1` with two nodes, `Chapter 2` empty, `Chapter 3` with one node; export PDF, `Whole project` | download `Story.pdf`; 2 `/Type /Page` entries; text contains `Story - Chapter 1` and `Story - Chapter 3`, not `Story - Chapter 2` | e2e/editor-export-project.spec.ts :: a whole-project PDF has a page per chapter with nodes |
| C2 | whole-project Word | e2e | as C1; export Word, `Whole project` | download `Story.docx`; `zipEntryText(bytes, 'word/document.xml')` has `Story - Chapter 1` and `Story - Chapter 3`, `<pic:pic` twice, no `Story - Chapter 2` | e2e/editor-export-project.spec.ts :: a whole-project Word file has a heading and map per chapter with nodes |
| C3 | trashed chapters and nodes stay out | e2e | as C1, then move `Chapter 3` to the trash and one `Chapter 1` node to the trash; export PDF, `Whole project` | 1 page; no `Story - Chapter 3` | e2e/editor-export-project.spec.ts :: trashed chapters are not exported |
| C4 | an empty project is refused | e2e | a new project, `Chapter 1` and an added `Chapter 2`, no nodes; export PDF, `Whole project` | the alert `This project has no nodes to export.`; no download within 2 s | e2e/editor-export-project.spec.ts :: a project with no nodes is refused |
| C5 | a large map is scaled and warned about | e2e | `Chapter 1` with a node at x 40 and one at x 40000; export PNG | `pngSize(...).width <= 8192` and above 0; the text `Some maps were large, so their labels may be small in the export.` and a `Close` button; `Close` closes the dialog | e2e/editor-export-project.spec.ts :: a large map is scaled to fit and the dialog warns |
| C6 | maps are legible and complete | manual | the developer exports a real project in each format, current chapter and whole project, in Firefox and Chromium, with a cross-chapter link and a dark-theme account | titles, previews, choices and the `→ Chapter: Node` tag read at 100 % zoom in each file; the files open in a PDF reader, Word or LibreOffice, and an image viewer | |

### Probes
**Probe folder:** `tests/probes/2026-11-21-export/task-4/`

### Breaks
none

### Flow
The manual items M4 (PDF), M5 (Word), M6 (JPG) and M7 (PNG) in `docs/test-plan.md`, run as case C6: the developer marks each `done` with the date. (Run by Claude Code on 2026-11-21 at the developer's request and recorded in the test plan; Microsoft Word and Adobe Reader were not available, so the Word file was read through LibreOffice and the PDF through poppler.)

### Evidence
The full output of `npm run check:task`, the `npm test` summary and any failing e2e run from Checkpoint 4A step 2.
