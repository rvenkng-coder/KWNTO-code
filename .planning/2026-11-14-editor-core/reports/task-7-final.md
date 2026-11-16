# Task report: Task 7 (the content door)

Task file: docs/superpowers/plans/2026-11-14-editor-core/task-7-content-door.md
Built by: strong (one session, base `aef5c4b`), checkpoints 7A, 7B and 7C

## Commits on `feat/editor-core`

| Commit | What |
|---|---|
| c9e6b8f | `test: probes for task 7` (22 probes for C1 to C6) |
| f7da0e1 | `feat: content types, mappers and guarded save` (7A) |
| 9e92221 | `feat: projects and content in the backend door` (7B) |
| a099e24 | `feat: live content changes` (7C, backend.md, status) |
| (this commit) | report |

## What was built

- `frontend/src/backend/content-types.ts`: the types of the Interfaces block, word for word.
- `frontend/src/backend/content-mappers.ts`: `fromRecord` has one reader per kind. An unknown colour becomes `slate` and an unknown cue type becomes `other`. `toUpdateBody` sends only the editable keys of that kind (a per-kind allow-list, so a stray `version` or `projectId` in `changes` is never sent). `deleted` becomes `deleted_at`, and `null` becomes `''`. `toCreateBody` sends every field under its stored name, but never `version` or `deleted`.
- `frontend/src/backend/guarded.ts`: `guardedSave`, `MAX_SAVE_TRIES`, `TOO_BUSY`. After the 20th conflict it does not re-read, because nothing would use the result.
- `frontend/src/backend/projects.ts`: `list` uses `team = {:team} && deleted_at = ''`, sorted by `-updated`. `create` sends `{ team, name }`.
- `frontend/src/backend/content.ts`: `load` makes 7 requests in parallel (pages of 1000). `create` keeps the client id. `update` builds a `GuardedIO` from `getOne` and a `PATCH` of `{ ...body, version }`. `remove` deletes. `subscribe` calls `realtime.ts`.
- `frontend/src/backend/realtime.ts`: opens seven subscriptions, one after another: `projects` by its record id, the rest with `project = {:project}`. If one fails to open, the ones already open are closed and the error is thrown as a `BackendError`.
- `client.ts` and `index.ts` wire in `projects` and `content`. `index.ts` also re-exports the content types, `MAX_SAVE_TRIES` and `TOO_BUSY`.
- `docs/developer/backend.md` covers `backend.projects` and `backend.content`: the types, the 409 retry and when it gives up, trashed records in `load`, the refused-create mapping, and that missed events are not replayed (Plan 4).

## Things to review (not in the Interfaces block)

1. **A refused create is reported as `forbidden`.** When a create rule refuses, PocketBase answers 400 "Failed to create record" with no field errors. Without a fix, C10 failed (`expected [ 'not-found', 'forbidden' ] to include 'invalid'`). `content.create` now reports a 400 with no field errors as `forbidden`. A validation error names its fields, so it stays `invalid`.
2. **`vitest.config.ts`: the `rules` project passes `execArgv: ['--experimental-eventsource']`.** Node 22 has `EventSource` only behind this flag, and the SDK's realtime needs it. No dependency is added. Each rules run prints one `[UNDICI-ES] Warning: EventSource is experimental`.
3. **Probes are not sealed.** No controller probes existed, so this session wrote them first, from the Test plan and the catalogue, before writing the tests or the code (as in Task 5). The implementer saw them.

## TDD record

- **7A:** `content-mappers.test.ts` and `guarded.test.ts` failed first (`Cannot find module './guarded'`, and likewise for the mappers). After the three files were written, unit passed (515), the probes passed 22 of 22, and breaks B1 to B3 were caught. Then typecheck failed on the test's fake (`noUncheckedIndexedAccess`), and the fake's signature was fixed.
- **7B:** C7 to C10 failed first (`TypeError: Cannot read properties of undefined (reading 'create')`, because there was no `backend.projects`). After `projects.ts` and `content.ts`, 3 of 4 passed. C10 failed as described in item 1 above, then passed. **Check that C9 works:** with the retry removed from `guarded.ts` (`throw error` on every error), C9 failed with the real 409 `This record was changed by someone else.`. The file was then restored with `git checkout`.
- **7C:** C11 and C12 failed first (`content.subscribe is not a function`), then passed. C12 waits for a control edit in the outsider's own project. That edit is made after B's two edits, and only then does the test assert that the outsider saw no other event.
- **Hygiene:** the first `check:task` run failed `hygiene`, because the 12 new tests had no `// Protects:` comment above them. The comments were added. No test logic changed.

## Not done

- No "open rule" check for C12. The view rules belong to Tasks 5 and 6, and their rule tests already pin outsiders out. C11 shows that the same subscription code delivers events to a member.

## `npm test`

Passed: lint, typecheck, unit 515, container 5, rules 184, e2e 52.

## `check:task` output

```
> kwnto@0.0.0 check:task
> node scripts/check-task.ts --task docs/superpowers/plans/2026-11-14-editor-core/task-7-content-door.md --base aef5c4b --built-by strong

PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: passed; e2e: not required by this task's test plan; container: not required by this task's test plan
PASS hygiene
PASS quality: check:quality: ok
PASS coverage: 12 cases point at tests that exist
PASS breaks: run-breaks: 3 caught
PASS probes: probes: 22 of 22 passed
INFO review: Review required: no (built by a strong model; the plan's own per-task review applies); escape rate 4 of 5 local tasks

check:task: PASS
```
