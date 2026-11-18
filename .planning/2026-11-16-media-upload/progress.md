# Progress: Media upload, quota and strict file checks

Plan: docs/superpowers/plans/2026-11-16-media-upload/README.md. Branch `feat/media-upload`, worktree `KWNTO-code-media`.

| Date | Task | Built by | What happened | Review | Escaped | Next |
|---|---|---|---|---|---|---|
| 2026-11-16 | Plan written | - | Router and task files, branched from `feat/editor-core` at 2975e67 | - | - | Task 1 (after Plan 3 is done and the branch is rebased) |
| 2026-11-18 | Plan updated after Plan 3 | - | Merged `main` (d8b50f5). D1 rewritten: checks before the insert, insert outside our transaction (Plan 3: a wrapped insert sends no live create event), quota re-check after it with `usedThrough` (Task 1 C8, B6); D8: delete question in the item, no `confirm()`; `MediaSection` goes in `NodeFields.tsx` | - | - | Task 1 |
| 2026-11-18 | Task 1 | strong | Upload checks (pure helpers in media-check.js), C1 to C8 unit tests and probes pass, all breaks caught | clean | 0 | Task 2 |
| 2026-11-19 | Task 2 | strong | Media collection migration, media create hook (magic bytes, quota, race check), safe download headers with nosniff and CSP, GET /api/kwnto/storage route. C1-C11 rule tests pass, 10/10 runs of C9 pass, check:task PASS | clean | 0 | Task 3 |

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
