# Progress: Media upload, quota and strict file checks

Plan: docs/superpowers/plans/2026-11-16-media-upload/README.md. Branch `feat/media-upload`, worktree `KWNTO-code-media`.

| Date | Task | Built by | What happened | Review | Escaped | Next |
|---|---|---|---|---|---|---|
| 2026-11-16 | Plan written | - | Router and task files, branched from `feat/editor-core` at 2975e67 | - | - | Task 1 (after Plan 3 is done and the branch is rebased) |
| 2026-11-18 | Plan updated after Plan 3 | - | Merged `main` (d8b50f5). D1 rewritten: checks before the insert, insert outside our transaction (Plan 3: a wrapped insert sends no live create event), quota re-check after it with `usedThrough` (Task 1 C8, B6); D8: delete question in the item, no `confirm()`; `MediaSection` goes in `NodeFields.tsx` | - | - | Task 1 |
| 2026-11-18 | Task 1 | strong | Upload checks (pure helpers in media-check.js), C1 to C8 unit tests and probes pass, all breaks caught | clean | 0 | Task 2 |
| 2026-11-19 | Task 2 | strong | Media collection migration, media create hook (magic bytes, quota, race check), safe download headers with nosniff and CSP, GET /api/kwnto/storage route. C1-C11 rule tests pass, 10/10 runs of C9 pass, check:task PASS | clean | 0 | Task 3 |
| 2026-11-19 | Task 3 | strong | Media types, file tokens, early upload check, media door against live PB. C1-C7 pass, B1-B2 caught, probes 4/4 passed, check:task PASS | clean | 0 | Task 4 |
| 2026-11-19 | Task 4 | strong | Media in properties panel, audio/video players, thumbnails, quota meter, inline delete confirm, e2e C1-C10 pass, B1 caught, probes 4/4 passed, check:task PASS | clean | 0 | Whole-branch review |
| 2026-11-20 | Whole-branch review | strong | Review found 10 issues; fixed 1-6 and 9 (token refresh, stale-project writes, subscribe first, reader close, explicit over-quota throw, quota fallback only on no rows, same-name uploads). Developer decision: storage belongs to the team lead (quota on the owner, members remove, owner restores or deletes, optional `uploader`); see the plan amendment. Rules, unit and e2e tests updated. Not fixed: issue 10 (stale pre-check), flaky race ordering. Commits 2d99bab, 8eca531 | found 9 | 0 | Developer review |

## Task 4 Report: Media in the properties panel and close-out

### Checkpoints
- **4A: The list logic**
  - Pure list helpers implemented in `frontend/src/features/editor/media/mediaList.ts` (`applyMediaEvent`, `mediaOf`, `meterText`).
  - Unit test C1 passed in `mediaList.test.ts`. Break B1 caught by `run-breaks`. Probes 4/4 passed. Commit `570ee2b`.
- **4B: The panel section**
  - Implemented `useProjectMedia.ts` with Zustand store, `MediaSection.tsx`, `MediaItem.tsx`, and `StorageMeter.tsx`.
  - Wired `MediaSection` into `NodeFields.tsx` (between `Cues` and `Choices`), and `useProjectMedia` into `EditorScreen.tsx`.
  - Configured thumbnail support (`thumbs: ["100x100"]`) in PocketBase collection migration `1794380000_media.js`.
  - Written comprehensive Playwright e2e test suite `e2e/editor-media.spec.ts` (C2-C9) across Chromium and Firefox.
  - Resolved panel scroll overflow containment and component complexity limits. Commit `f00e921`.
- **4C: Walk and close-out**
  - Walked the Flow in Chromium and Firefox: attached multiple files to multiple nodes, switched nodes, confirmed proper node filtering via `mediaOf`, trashed node with media (files hidden from view, meter stays unchanged), restored with undo (files reappear), deleted media with inline confirmation (no browser dialog popups, space freed immediately, meter updated), confirmed quota rejection when admin lowers override limit.
  - Updated documentation: `docs/user/editor.md` (Media section), `docs/security.md` (section 4 & malicious upload), `docs/test-plan.md` (marked covered), `docs/superpowers/plans/README.md` (marked Plan 5 done, added carried over item to Plan 6), `docs/superpowers/plans/2026-11-16-media-upload/README.md` (all tasks done).
  - All unit tests (614 passed), rules tests, and e2e tests (177 passed) pass cleanly.

### check:task Output
```
PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: not required by this task's test plan; e2e: passed; container: not required by this task's test plan
PASS hygiene
PASS quality: check:quality: ok
PASS coverage: 10 cases point at tests that exist
PASS breaks: run-breaks: 1 caught
PASS probes: probes: 4 of 4 passed
INFO review: Review required: no (built by a strong model; the plan's own per-task review applies); escape rate 0 of 0 local tasks

check:task: PASS
```

## Task 3 Report: The media door

### Checkpoints
- **3A: Mapping, tokens and the early check**
  - Types in `frontend/src/backend/media-types.ts`, `fromMediaRecord` in `frontend/src/backend/media.ts`.
  - Token cache in `frontend/src/backend/file-tokens.ts` (90s reuse window, inflight request deduping, error clearing).
  - Early browser-side check in `frontend/src/features/editor/media/uploadCheck.ts` (`formatSize`, `earlyProblem`).
  - Unit tests C1-C3 passed; breaks B1 and B2 caught; probes 4/4 passed. Commit `8d47ec3`.
- **3B: The door against a live PocketBase**
  - Implemented `createMedia(pb)` in `frontend/src/backend/media.ts` providing `list`, `upload`, `remove`, `storage`, `fileUrl`, `fileToken`, and `subscribe`.
  - Exported `media` on backend door in `frontend/src/backend/client.ts` and `frontend/src/backend/index.ts`.
  - Documented `backend.media` in `docs/developer/backend.md`.
  - Rule tests C4-C7 in `tests/rules/media-door.rules.test.ts` passed against live PocketBase.
  - Resolved complexity and line limit requirements cleanly. Commit `1762fb4`.

### check:task Output
```
PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: passed; e2e: not required by this task's test plan; container: not required by this task's test plan
PASS hygiene
PASS quality: check:quality: ok
PASS coverage: 7 cases point at tests that exist
PASS breaks: run-breaks: 2 caught
PASS probes: probes: 4 of 4 passed
INFO review: Review required: no (built by a strong model; the plan's own per-task review applies); escape rate 0 of 0 local tasks

check:task: PASS
```

## Task 2 Report: The media collection, hook and headers

### Checkpoints
- **2A: The collection and its rules**
  - Migration `backend/pb_migrations/1794380000_media.js` created with protected single-file `file` (1 GiB ceiling), `project`, `node`, `uploader`, `title`, `kind`, `size_bytes`.
  - Step 4 rule-opening verification: when `createRule` was temporarily opened to `@request.auth.id != ''`, C2 failed as expected (forged fields and outsider uploads were accepted); restoring strict rule restored C2 to pass. Commit `25ead80`.
- **2B: The upload hook**
  - Step 6 findings: PocketBase 0.40.6 `onRecordCreate` accesses `e.record.get("file")` (`*filesystem.File`), first 16 bytes via `file.reader.open()` with `toBytes(reader, 16)`, and `file.name` assignment renames stored file.
  - Race check: insert stays outside user transactions (`e.next()`), followed by `e.app.runInTransaction` checking `usedThrough`. If quota exceeded, deletes `e.record` in transaction and throws `BadRequestError` with `ValidationError("media_over_quota", ...)` outside transaction so deletion commits.
  - 10 of 10 runs of C9 passed consistently. Commit `007b19d`.
- **2C: Safe headers and usage route**
  - Implemented `onFileDownloadRequest` setting `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; img-src 'self'; media-src 'self'; sandbox`, and `Content-Type` from stored extension.
  - Implemented route `GET /api/kwnto/storage` with `$apis.requireAuth("users")` and `e.auth.verified()`, returning `usedBytes`, `quotaBytes`, `maxBytes`, `allowedTypes`.
  - Updated `docs/developer/backend.md`, `docs/superpowers/specs/2026-11-11-kwnto-erd.md`, `docs/admin/settings.md`. Commit `ef3cf09`.

### check:task Output
```
PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: passed; e2e: not required by this task's test plan; container: not required by this task's test plan
PASS hygiene
PASS quality: check:quality: ok
PASS coverage: 11 cases point at tests that exist
PASS breaks: run-breaks: no breaks listed
PASS probes: the Test plan names no probe folder (none)
INFO review: Review required: no (built by a strong model; the plan's own per-task review applies); escape rate 0 of 0 local tasks

check:task: PASS
```

## Whole-branch review follow-up (2026-11-20): check:task

Run against Task 4's file with `--base 5dd6f9c` (the commit before the review fixes), built by strong. The `hygiene` step reports six `lost-test` entries. They are deliberate renames from the developer's decision that storage belongs to the team lead (a member removes, only the lead restores or deletes for good); each has a replacement test. The developer (reviewer) accepted the renames on 2026-11-20. `check:task` has no allow-list for this, so its verdict stays FAIL on that step alone. The two Task 4 probes (`probe-media-of`, `probe-meter-text`) were updated with the developer's approval: fixtures gain `removedAt` and `isLead`, and the meter label is `Team storage:`.

```
PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: not required by this task's test plan; e2e: passed; container: not required by this task's test plan
FAIL hygiene
PASS quality: check:quality: ok
PASS coverage: 10 cases point at tests that exist
PASS breaks: run-breaks: 1 caught
PASS probes: probes: 4 of 4 passed
INFO review: Review required: no (built by a strong model; the plan's own per-task review applies); escape rate 0 of 0 local tasks

FAIL hygiene:
  e2e/editor-media.spec.ts: lost-test: test "deleting a file asks first and frees its space" is gone (removed, or renamed: the reviewer decides)
  e2e/editor-media.spec.ts: lost-test: test "a teammate's upload and delete appear without a reload" is gone (removed, or renamed: the reviewer decides)
  tests/rules/media-door.rules.test.ts: lost-test: test "removing a file frees its space at once" is gone (removed, or renamed: the reviewer decides)
  tests/rules/media-door.rules.test.ts: lost-test: test "teammates see uploads and deletes live and outsiders do not" is gone (removed, or renamed: the reviewer decides)
  tests/rules/media.rules.test.ts: lost-test: test "media is never edited and only members delete it" is gone (removed, or renamed: the reviewer decides)
  tests/rules/media.rules.test.ts: lost-test: test "the storage route tells a person only their own usage and limits" is gone (removed, or renamed: the reviewer decides)

check:task: FAIL (1 steps)
```

## Merge of `origin/main` into `feat/media-upload` (2026-11-20)

`main` had moved 40 commits (Plan 4, offline sync). Three doc conflicts (`docs/developer/backend.md`, `docs/superpowers/plans/README.md`, `docs/user/editor.md`) resolved by keeping both sides; the user guide's Media section now describes remove, restore and team storage. One behaviour conflict found by the e2e run: Plan 4's `a choice refused by the unique pair index lands in the failed list` failed on Chromium with the media live subscription open. Cause and fix are in the plan amendment (`keepMediaOpen`). After the merge: `npm test` (679 unit, 5 container, 214 rules) and the whole e2e suite (214) pass.

