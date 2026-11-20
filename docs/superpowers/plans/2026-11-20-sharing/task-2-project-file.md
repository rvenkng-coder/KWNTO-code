# Task 2: Project files: export and import

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Checkpoint 2A tier:** mid
**Checkpoint 2C tier:** mid
**Depends on:** Task 1

Design 10: a project can be exported to and imported from a JSON file of itself. Security.md 5 "Bad imports": the file is untrusted input, validated by schema with size limits, with unit tests on malformed and oversized files (design 8b). The same builder makes snapshots and the share view (Task 3), so this task fixes the format (D5) and the one validator (D3, D4).

**Files:**
- Create: `backend/pb_hooks/lib/project-file.js`, `tests/hooks/project-file.unit.test.ts`, `tests/hooks/project-file.import.unit.test.ts`, `backend/pb_hooks/project-file.pb.js`, `tests/rules/project-file.rules.test.ts`, `frontend/src/backend/projectFiles.ts`, `frontend/src/backend/projectFiles.test.ts`, `frontend/src/features/projectFile/ExportButton.tsx`, `frontend/src/features/projectFile/ImportProject.tsx`, `e2e/project-file.spec.ts`, `docs/developer/project-file.md` (the format, field by field, the limits and every problem message)
- Modify: `frontend/src/backend/client.ts`, `index.ts` (`projectFiles`), the editor's left panel (`Export project file` under the project name), `frontend/src/features/teams/TeamDetail.tsx` (`Import project` under the projects list), `docs/user/editor.md` ("Export and import a project"), `docs/developer/backend.md` (routes), `docs/security.md` (section 5 "Bad imports": built, with the tests named)

**Interfaces:**
- Consumes: the collections' field definitions (read the max lengths and the `color` and cue `type` values from `1794370000_projects_chapters.js`, `1794370100_nodes_lines_connections.js` and `1794370200_open_choices.js`; write them into `FILE_LIMITS` and say which in a comment), `memberProject`, `createNode`, `createLine` (`tests/rules/helpers/content.ts`), `uploadMedia` (`tests/rules/helpers/media.ts`).
- Produces, `lib/project-file.js` (CommonJS):

```js
const FILE_LIMITS = { maxBytes: 5242880, chapters: 200, nodes: 2000, lines: 20000, cues: 10000, connections: 10000,
  name: <projects.name max>, title: <nodes.title max>, chapterTitle: <chapters.title max>, character: <max>, text: <max>, label: <max> }
// records: { project, chapters, nodes, script_lines, cues, connections, media } as plain objects with stored field names.
// Leaves out records with deleted_at set, nodes of a trashed chapter, and media with removed_at set.
function buildProjectFile(records, nowIso) -> ProjectFile           // D5 shape, arrays sorted by position, sortOrder, then id
// Never throws. Copies only known keys into fresh objects. Stops after 20 problems.
function validateProjectFile(value, limits) -> { ok: true, file: ProjectFile } | { ok: false, problems: string[] }
// newId() returns a fresh 15-character id. Every id is replaced; every reference mapped.
function importPlan(file, newId) -> { name, startNode: string | null, chapters: [], nodes: [], lines: [], cues: [], connections: [] }
module.exports = { FILE_LIMITS, buildProjectFile, validateProjectFile, importPlan }
```

- Produces, problem messages (exact; `<path>` is like `nodes[3].chapter`): `it is not JSON`, `format must be "kwnto-project"`, `version must be 1`, `<path> is missing`, `<path> must be a string`, `<path> must be a number`, `<path> must be one of <values, comma-separated>`, `<path> is longer than <n> characters`, `too many <list> (<count>, at most <limit>)`, `<path> is not a <chapter|node> in the file`, `duplicate id "<id>" in <list>`, `unknown key "<key>" in <path>`.
- Produces, routes (`project-file.pb.js`): `GET /api/kwnto/projects/{id}/export`: a member gets 200 JSON with `Content-Disposition: attachment; filename="<name, letters digits - _ only>.kwnto.json"`; anyone else 404 `No project with this id.` (signed out 401). `POST /api/kwnto/teams/{id}/import`: verified member (401, 403, outsider 404 `No team with this id.`); the raw body over `maxBytes` gives 413 with the router's too-large copy; otherwise parse, `validateProjectFile`, and on a problem 400 with `This file is not a KWNTO project: <first problem>`; else, in one `e.app.runInTransaction`, create the project named `<name> (imported)`, reuse its `Chapter 1` for the first chapter (D6), create the rest from `importPlan`, set `start_node`, and answer 200 `{ projectId }`.
- Produces, door `backend.projectFiles`: `download(projectId: string): Promise<{ name: string; blob: Blob }>` and `importFile(teamId: string, file: File): Promise<string>` (refuses `file.size > MAX_IMPORT_BYTES`, with `export const MAX_IMPORT_BYTES = 5242880`, before sending, with the same copy; returns the new project id).

**If interrupted:** the rules and e2e suites run on a throwaway backend; nothing persists.

## Checkpoint 2A: Format and validator

- [x] **Step 1: Write the failing tests** C1 and C2 in `tests/hooks/project-file.unit.test.ts` and C3 in `tests/hooks/project-file.import.unit.test.ts`.
- [x] **Step 2: Run** `npx vitest run --project unit tests/hooks/project-file.unit.test.ts tests/hooks/project-file.import.unit.test.ts`. Expected: FAIL.
- [x] **Step 3: Implement** `lib/project-file.js`. Reference checks use a `Set` of the file's own ids per list (B1: `if (!nodeIds.has(c.from))`); count checks `if (list.length > limit)` (B2); unknown keys are refused by comparing against a fixed key list per record kind (B3: the `__proto__` case must still be refused). Write `docs/developer/project-file.md`.
- [x] **Step 4: Run** it. Expected: PASS. **Close checkpoint 2A** (commit `feat: the project file format and validator`).

## Checkpoint 2B: The routes

- [ ] **Step 5: Confirm** how a 0.40.6 route reads the raw body and its length (`e.request.body`, `toString(...)`, `e.request.contentLength`) in `types.d.ts`; record it in `progress.md`. The size check must happen before parsing.
- [ ] **Step 6: Write the failing tests** C4 to C6 in `tests/rules/project-file.rules.test.ts`; run, expect FAIL.
- [ ] **Step 7: Implement** `project-file.pb.js`.
- [ ] **Step 8: Run** `npm run test:rules`. Expected: PASS. **Close checkpoint 2B** (commit `feat: export and import routes`).

## Checkpoint 2C: The buttons

- [ ] **Step 9: Write the failing tests** C7 in `projectFiles.test.ts` and C8, C9 in `e2e/project-file.spec.ts`; run, expect FAIL.
- [ ] **Step 10: Implement** the door, `ExportButton` (downloads through an object URL, revoked after the click) and `ImportProject` (a labelled file input; the server's message in `role="alert"`; on success opens the new project).
- [ ] **Step 11: Run** `npm run test:unit` and `npm run test:e2e`. Expected: PASS. Update the docs. **Close checkpoint 2C** (commit `feat: export and import buttons`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | build | unit | records with 2 chapters (one trashed), 3 nodes (one trashed, one in the trashed chapter), lines out of order, a choice to the trashed node, an empty choice, 2 media (one removed) | only live records; lines ordered by `sortOrder`; the choice to the trashed node has `to: null`; the empty choice kept; one media entry; `format`, `version`, `exportedAt` set | tests/hooks/project-file.unit.test.ts :: the file holds only what is live, in order |
| C2 | validate refuses bad files | unit | `null`; `[]`; `format` wrong; `version` 2; a node whose `chapter` is not in the file; a connection `to` an unknown node; `startNode` unknown; 2,001 nodes; a line text one over the limit; a colour `pink`; a duplicate node id; a node with key `__proto__` (from `JSON.parse`); 25 bad lines | `ok: false` with exactly the documented message for each (the first for the 25 lines; 20 problems listed); `Object.prototype` unchanged | tests/hooks/project-file.unit.test.ts :: an untrusted file is refused with the first problem named |
| C3 | import plan | unit | a valid file; `newId` yielding `n1`, `n2`, ... | every id replaced, no old id left anywhere in the plan; every `chapter`, `node`, `from`, `to` and `startNode` maps to the new ids; `to: null` stays null; `validateProjectFile(buildProjectFile(...))` of the result's source is `ok` (round trip) | tests/hooks/project-file.import.unit.test.ts :: an import gives every record a new id and keeps the links |
| C4 | export route | rules | member exports a project with a node, a line and a choice; outsider; signed out; an id `' OR 1=1 --` | 200, a valid file with those records and the `Content-Disposition` filename; 404; 401; 404 | tests/rules/project-file.rules.test.ts :: only members export a project |
| C5 | import route | rules | a member imports an exported file twice; an outsider imports into the team; an unverified member; signed out | two new projects `<name> (imported)` with their own ids and the same structure (counts, titles, links, start node); the original untouched; 404; 403; 401 | tests/rules/project-file.rules.test.ts :: a member imports a file as a new project |
| C6 | import refuses and leaves nothing | rules | a 5 MB + 1 byte body; text `not json`; a file whose last connection points at an unknown node; a file with 2,001 nodes | 413 with the too-large copy; 400 `This file is not a KWNTO project: it is not JSON`; 400 naming the connection; 400 naming the count; after each, the team has exactly the projects it had before (admin count, chapters and nodes too) | tests/rules/project-file.rules.test.ts :: a refused import creates nothing |
| C7 | door | unit | `importFile` with a 5 MB + 1 byte `File`; with a small one (fake fetch answering `{ projectId: 'p' }`) | the too-large copy and no request; `'p'` | frontend/src/backend/projectFiles.test.ts :: the door refuses large files and returns the new project |
| C8 | export then import (design 8b) | e2e | a project with 2 chapters, a cross-chapter choice and a script line; `Export project file`; on the team page `Import project` with the downloaded file | a project `<name> (imported)` opens with both chapters, the line, and the cross-chapter tag on the source node | e2e/project-file.spec.ts :: a project exported and imported again keeps its chapters, lines and links |
| C9 | a bad file in the browser | e2e | import a `.json` holding `{"format":"other"}` | alert `This file is not a KWNTO project: format must be "kwnto-project"`; no new project in the list | e2e/project-file.spec.ts :: a file that is not a project is refused with the reason |
### Probes
**Probe folder:** `tests/probes/2026-11-20-sharing/task-2/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | backend/pb_hooks/lib/project-file.js | `if (!nodeIds.has(c.from))` | `if (false)` | tests/hooks/project-file.unit.test.ts |
| B2 | backend/pb_hooks/lib/project-file.js | `if (list.length > limit)` | `if (list.length > limit + 1)` | tests/hooks/project-file.unit.test.ts |
| B3 | frontend/src/backend/projectFiles.ts | `file.size > MAX_IMPORT_BYTES` | `file.size > MAX_IMPORT_BYTES * 2` | frontend/src/backend/projectFiles.test.ts |
### Flow
In Firefox and Chromium: export a real project, open the file in a text editor (readable, no internal fields), import it into another team, compare by eye. Record what you saw in `progress.md`.
### Evidence
The full output of `npm run check:task`, the Step 5 findings, and the failing run of each break.
