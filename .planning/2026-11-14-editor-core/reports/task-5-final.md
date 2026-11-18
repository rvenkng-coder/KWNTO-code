# Task report: Task 5 (guarded write, projects, chapters, project settings)

Task file: docs/superpowers/plans/2026-11-14-editor-core/task-5-guard-projects-chapters.md
Built by: strong (one session, base `dd22860`), checkpoints 5A, 5B and 5C

## Commits on `feat/editor-core`

| Commit | What |
|---|---|
| c782b1b | `test: probes for task 5`: 12 probes, rows C1 to C4 |
| cb4fe9e | `feat: content guard helpers` (5A) |
| 3b8c820 | `feat: projects, chapters and project settings with guarded updates` (5B) |
| (this commit) | `test: concurrent edits keep both fields` (5C, docs) |

## Probes are not sealed

The plan has the controller write probes before dispatch. This task was built inline by one strong session with no separate controller, so the same session wrote the probes. It wrote them from the Test plan and the catalogue only, before it wrote the unit tests and the code, and committed them first. They are still not independent of the implementer. They cover C1 to C4 only, because the `probes` Vitest project has no PocketBase.

## What was built

- `backend/pb_hooks/lib/content-guard.js`: `GUARDED`, `guardedTable`, `changedFields`, `parseSentVersion`.
- `backend/pb_migrations/1794370000_projects_chapters.js`: `projects`, `project_settings`, `chapters` with `version`, the rule fragments of the Interfaces block, delete `null`, team delete cascades to projects (D13).
- `backend/pb_hooks/content-guard.pb.js`: the guarded update on `onRecordUpdateRequest` for all seven names, following the spike. It has three changes from the spike: the table comes from `guardedTable`; the sent version is read from the **request body** (`e.requestInfo().body.version`) through `parseSentVersion` (a non-integer is a 400 `version is required`); the changed fields come from `changedFields`.
- `backend/pb_hooks/projects.pb.js`: settings row and `Chapter 1` (position 1) in one transaction with the project.
- Tests: `tests/hooks/content-guard.unit.test.ts` (C1 to C4), `tests/rules/{projects,project_settings,chapters,content-guard}.rules.test.ts` (C5 to C16), `tests/rules/helpers/content.ts`.
- Docs: ERD (`version` on the seven collections, chapters `created`/`updated` and decimal `position`, `project_settings` default, D13 cascade, a note on the guard), `docs/developer/backend.md` "Guarded writes", `docs/admin/settings.md` `project_settings`, `docs/developer/testing.md` content helpers and rule fragments.

## TDD record

- **5A:** C1 to C4 failed first (module not found), then passed. Breaks B1 to B3 were all caught. Probes passed 12 of 12.
- **5B:** C5 to C14 failed first (10 of 10; the collections did not exist yet). The migration and the hooks were written next, and all 10 passed on the first run. Full rules suite: 158 passed.
- **Step 8 (check order):** C11 and C12 pass, so in 0.40.6 the update rule runs before `onRecordUpdateRequest`. No design change is needed.
- **Step 9 (open rule):** the `chapters` update rule was opened to `@request.auth.id != ''`. C11 failed (`expected [ 403, 404 ] to include 200`: the outsider's update went through). C12 failed too (a 400 from the hook instead of the rule's refusal), and so did C13 (200). The rule was then restored.
- **5C:** C15 and C16 were written after the guard existed, so they passed at once. To show they can fail, the guard was broken twice and then restored:
  - With `AND version = {:version}` removed from the guard's `UPDATE`, both failed: `409 answers in round 1: expected +0 to be 1` and `expected 200 to be 409`.
  - Copying every field from the request instead of only the changed ones did **not** make C15 fail. The loser of each round re-reads after its 409, so its copy is fresh. That makes the version check the real protection, and `changedFields` a second line of defence.
- **Step 12:** `content-guard.rules.test.ts` ran 4 times, 2 of 2 passing each time.

## Notes for the reviewer

- Without `version` in the body, the **update rule** refuses the call (403 or 404), so the hook's 400 is reached only by a `version` that is present but not a whole number from 0. C12 asserts 403 or 404 for the missing version, which is the evidence that the rule runs first.
- Admin saves from the dashboard also go through the guard. I expect the dashboard to send the `version` it loaded, but this is **not tested**, and the docs say so.

## `check:task` output

```
> kwnto@0.0.0 check:task
> node scripts/check-task.ts --task docs/superpowers/plans/2026-11-14-editor-core/task-5-guard-projects-chapters.md --base dd22860 --built-by strong

PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: passed; e2e: not required by this task's test plan; container: not required by this task's test plan
PASS hygiene
PASS quality: check:quality: ok
PASS coverage: 16 cases point at tests that exist
PASS breaks: run-breaks: 3 caught
PASS probes: probes: 12 of 12 passed
INFO review: Review required: no (built by a strong model; the plan's own per-task review applies); escape rate 4 of 5 local tasks

check:task: PASS
```
