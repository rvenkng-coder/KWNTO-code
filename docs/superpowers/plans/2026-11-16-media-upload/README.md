# Media Upload, Quota and Strict File Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A team member attaches audio (WAV, MP3), video (MOV, MP4) and images (JPEG, PNG) to a node from the properties panel. The server checks each file's first bytes, size and the uploader's quota, stores it under a generated name, and serves it with headers that stop a browser from guessing its type. Only the project's team can read it.

**Architecture:** A new `media` collection with a protected single-file field. The `media` create hook runs every check before the record is stored: type from magic bytes, the per-kind size limit and the quota, all read from `system_storage` and `user_limits` at run time. The insert itself stays outside any transaction of ours, so teammates get the live create event (Plan 3's finding); a second quota check right after the insert removes the later of two parallel uploads that together went over (D1). Every decision is a pure function in `backend/pb_hooks/lib/media-check.js`. A small route tells the browser its own usage and limits, so the panel can refuse early and show a meter. The browser reaches it all through `backend.media`.

**Tech Stack:** PocketBase 0.40.6 (JS hooks, migrations, protected files and file tokens), `pocketbase` JS SDK 0.28, React 19, TypeScript, Zustand 5, Vitest, Playwright. No new dependencies.

**Spec:** [Design](../../specs/2026-11-11-kwnto-design.md) sections 5 (members upload media), 6.2 (types, quota, per-file limits, strict checks), 6.7 (uploads wait for the connection), 6.8 (trashed media counts toward quota), 7c (`system_storage`, `user_limits`), 8b (rule tests for quota and type and size limits); the [ERD](../../specs/2026-11-11-kwnto-erd.md) (`media`, "Quota"); [security.md](../../../security.md) section 4 "Uploads" and section 5 "Malicious upload"; the [roadmap](../README.md) outline "5. Media upload, quota and strict file checks". Also binding: [engineering.md](../../../engineering.md), [testing-strategy.md](../../../testing-strategy.md), [backend.md](../../../developer/backend.md), [admin settings](../../../admin/settings.md). Executors read all of them, and the [editor core plan](../2026-11-14-editor-core/README.md) router, whose panel this plan extends.

**Standard:** test-plan-v1

## Global Constraints

Everything in the [Plan 1 router](../2026-11-11-foundation/README.md) "Global Constraints" still applies (zero cost, no new dependency, ask first, worktree, 300-line files, no `any`, deny by default, tests documented, prototype is reference only, secrets never in git, docs are part of done, Node 22, ports). Values this plan depends on:

- **Worktree and branch:** `feat/media-upload` in the sibling folder `../KWNTO-code-media`, created from `feat/editor-core` at 2975e67 and brought up to date by merging `main` at d8b50f5 (2026-11-18: Plan 3, the editor tabs plan and the editor cards plan, all `done`). Merge `main` again before a task if it has moved (for example after Plan 4 lands); never rebase this pushed branch without the developer's approval (engineering 5). Nothing here needs Plan 4's code (D9). Tracking in `.planning/2026-11-16-media-upload/progress.md`.
- **Every task ends with** `npm run check:task -- --task docs/superpowers/plans/2026-11-16-media-upload/task-<n>-<name>.md --base <sha at task start> --built-by <local|strong>`, full output pasted in the report.
- **Probes are written by the controller, not the implementer**, before a task is dispatched.
- **Limits are settings, never code** (design 7c, engineering 9): `system_storage.default_quota_bytes` (2 GB), `max_video_mb` (200), `max_audio_mb` (50), `max_image_mb` (50), `allowed_types` (`wav`, `mp3`, `mov`, `mp4`, `jpeg`, `png`), and `user_limits.quota_override_bytes` (0 = use the default). The hook reads them on every upload. 1 MB = 1,048,576 bytes.
- **The server decides `kind`, `size_bytes`, `uploader` and the stored file name.** Anything the browser sends for them is refused or overwritten (D3).
- **Quota counts every `media` row of the uploader**, in every project and including rows under a trashed node or project (design 6.8: until purged). Over quota, the upload is refused and nothing already stored is touched (security.md 4).
- **Verified accounts only** upload (security.md 3: "uploading media" needs `@request.auth.verified = true`).
- **Exact copy** (tests compare it; `<…>` filled in by `checkUpload`):
  - Type not allowed: `This file type is not allowed. Allowed: <TYPES>.` (`<TYPES>` the allowed list in upper case, comma-separated, in the order WAV, MP3, MOV, MP4, JPEG, PNG)
  - Contents do not match: `This file is not a real <TYPE> file.` (`<TYPE>` from the extension, upper case; `.jpg` is `JPEG`)
  - Too large: `This <kind> file is larger than the <N> MB limit.` (`<kind>`: `video`, `audio`, `image`)
  - Over quota: `Not enough storage: this file is <size> and you have <free> of <quota> left. Nothing was deleted.`
  - Offline: `Uploads need a connection. Try again when you are back online.`
  - Sizes by `formatBytes`: below 1 MB as whole `KB`, below 1 GB as `MB` with one decimal, otherwise `GB` with one decimal (`1.5 GB`, `200.0 MB`, `12 KB`).
- **Migrations:** new files from `1794380000_*` upward in `backend/pb_migrations/`. The new collection needs `tests/rules/media.rules.test.ts` (the coverage check fails otherwise). No rule is public (`""`).

## Review Focus

The failure modes the spec implies that are most likely to bite a person, each pinned by a test in the task named:

1. **Two uploads at the same moment that each fit the quota but not together:** exactly one is stored. (Task 2 C9)
2. **A renamed file is refused.** A PNG renamed `.mp3`, an HTML page renamed `.jpg` and a file of zeros named `.wav` are all refused with the "not a real" message, and a `.jpg` that really is a JPEG is accepted. (Task 1 C1 and C2, Task 2 C5)
3. **A file cannot be read by anyone outside the team**: not a signed-out caller, not an outsider who has the file URL, not an outsider with their own file token. (Task 2 C3)
4. **A stored file never runs as a page:** the response carries `X-Content-Type-Options: nosniff`, the content type of its real kind and a CSP that forbids scripts. The stored name is generated and never contains the uploaded name. (Task 2 C6, C1)
5. **The quota the person sees matches the one the server enforces**, including the admin's per-user override and files under trashed nodes. (Task 1 C4, Task 2 C7 and C10, Task 3 C3)

Also covered, lower risk: a stored upload reaches a teammate's open panel as a live create event, because the insert is not wrapped in a transaction (Task 3 C7, Task 4 C8); the admin changing a limit applies to the next upload without a restart (Task 2 C8); deleting a file frees its space at once (Task 4 C7).

## Decisions made in this plan (please review)

The roadmap's "Decide first" items and calls where the spec is silent. Each is cheap to change before the task that builds it.

| # | Decision | Task |
|---|---|---|
| D1 | **Where the checks run:** in the `media` create hook (`onRecordCreate`), **before** the record's insert (`e.next()`): the first 16 bytes, the type, the size limit and the quota (`checkUpload` in `backend/pb_hooks/lib/media-check.js`). PocketBase's own `mimeTypes` field option is not used, because the allowed list must be an admin setting. **The insert is not wrapped in a transaction of ours:** Plan 3 found that PocketBase 0.40.6 then sends no live create event ([backend.md](../../../developer/backend.md), "A record create is not a transaction"). Two parallel uploads could therefore both pass the check before either is stored, so **after** `e.next()` the hook reads, in its own `e.app.runInTransaction`, the uploader's files and adds them up in the order `created`, then `id`, up to and including the new one (`usedThrough`). If that is over the quota it deletes the new record (PocketBase removes its file) and refuses the upload with the over-quota error. Both uploads see the same order, so exactly one stays. A teammate may see the refused one appear and vanish. If Task 2 Step 6 shows the model hook cannot read the uploaded bytes, the byte and size checks move to `onRecordCreateRequest` and only the quota re-check stays in `onRecordCreate`. | 1, 2 |
| D2 | **How a refused upload reports which limit it hit:** 400 with `data.file = { code, message }`, where `code` is `media_type_not_allowed`, `media_not_real`, `media_too_large` or `media_over_quota` and `message` is the copy above. The door turns it into `BackendError` `invalid` with `fields.file`. | 1, 2, 3 |
| D3 | **Fields:** `media` = `project` (relation, cascade), `node` (relation, cascade), `uploader` (relation to users, required), `file` (single file, **protected**, `maxSize` 1 GiB as a hard ceiling above any admin limit), `title` (text, max 120: the uploaded name for display, set by the hook from the file), `kind` (`audio`, `video`, `image`, set by the hook), `size_bytes` (set by the hook), `created`. The create rule refuses a body that sets `kind`, `size_bytes` or `title`, and requires `uploader = @request.auth.id`. There is no update rule (`null`): media is never edited. | 2 |
| D4 | **Stored name:** the hook renames the file to `<15 random a-z0-9>.<ext>` (`ext` from the detected type: `wav`, `mp3`, `mov`, `mp4`, `jpg`, `png`). The uploaded name survives only as `title`, which is shown as text. | 2 |
| D5 | **Reading files:** the field is protected, so `/api/files/...` needs a file token and passes the `media` view rule (team members). The door asks for a token (`pb.files.getToken()`) when a panel opens and again when it expires (PocketBase's token lasts about 2 minutes, so the door refreshes it at 90 s). Share-link viewers (Plan 7) will need their own route; that is Plan 7's problem. | 2, 3 |
| D6 | **Headers:** an `onFileDownloadRequest` hook on `media` sets `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; img-src 'self'; media-src 'self'; sandbox` and `Content-Type` from the stored extension. Caddy (Plan 6) adds site-wide headers on top. | 2 |
| D7 | **Detecting the type** (first bytes): PNG `89 50 4E 47 0D 0A 1A 0A`; JPEG `FF D8 FF`; WAV `RIFF` at 0 and `WAVE` at 8; MP3 `ID3` at 0, or a frame sync `FF` followed by a byte whose top 3 bits are set (`(b & 0xE0) === 0xE0`); MOV or MP4 `ftyp` at 4 (brand `qt  ` at 8 is MOV, any other brand MP4), or `moov`, `mdat`, `wide`, `free` or `skip` at 4 (MOV). **MOV and MP4 count as one family** when the extension is compared, since both are the same container and phones mislabel them. The type must still be on `allowed_types`. | 1 |
| D8 | **Who deletes:** any team member deletes a file outright, after a question drawn in the item itself, never `confirm()` (the developer listed browser pop-ups as a UI problem on 2026-11-18): `Delete <title>? This cannot be undone.` with `Delete` and `Cancel`; there is no undo, because a deleted file cannot be re-created. The space is freed at once. Trashing a node keeps its media, which still counts (design 6.8); Plan 7's purge deletes it. | 2, 4 |
| D9 | **Offline:** the upload button is disabled while `navigator.onLine` is false, and an upload that fails as `unreachable` shows the offline copy. Uploads are never queued (design 6.7). This does not use Plan 4's sync engine, so the plans do not depend on each other. | 4 |
| D10 | **Usage route:** `GET /api/kwnto/storage` (signed-in, verified) answers `{ usedBytes, quotaBytes, maxBytes: { audio, video, image }, allowedTypes }` for the caller only. `user_limits` and `system_storage` stay admin-only. | 2, 3 |
| D11 | **Live updates:** `media` gets its own subscription filtered by project (`backend.media.subscribe`), not one of Plan 3's seven content kinds, because media is never guarded or edited. | 3 |
| D12 | **No upload progress bar** in this plan (the SDK's `fetch` reports none). The panel shows `Uploading <title>…` until the answer. If large uploads through Funnel prove slow (Plan 6), a progress bar is a follow-up. | 4 |

## File structure

| Path | Responsibility |
|---|---|
| `backend/pb_hooks/lib/media-check.js` | Pure: `detectType`, `extensionType`, `kindOf`, `quotaFor`, `formatBytes`, `checkUpload`, `usedThrough` |
| `backend/pb_hooks/lib/settings.js` | Gains `getSystemStorage` |
| `backend/pb_migrations/1794380000_media.js` | The `media` collection |
| `backend/pb_hooks/media.pb.js` | The create hook (D1, D4), the download headers (D6), the storage route (D10) |
| `frontend/src/backend/media.ts`, `media-types.ts` | `backend.media` |
| `frontend/src/features/editor/media/` | `uploadCheck.ts` (the browser's early check), `mediaStore.ts`, `MediaSection.tsx`, `MediaItem.tsx`, `StorageMeter.tsx` |
| `tests/hooks/media-check.unit.test.ts`, `tests/rules/media.rules.test.ts`, `tests/rules/media.limits.rules.test.ts`, `tests/rules/media-door.rules.test.ts`, `tests/rules/helpers/media.ts` | Tests; sample files are built in memory by the helper |
| `e2e/editor-media.spec.ts` | Browser flows |
| `docs/user/editor.md`, `docs/admin/settings.md`, `docs/developer/backend.md`, `docs/security.md`, `docs/specs` ERD, `docs/test-plan.md` | Docs |

## Tasks

| # | Task | Tier | Depends on | Checkpoints | Status |
|---|---|---|---|---|---|
| 1 | [The upload checks](task-1-upload-checks.md) | mid (1A local) | Plan 3 | 1A 1B | done |
| 2 | [The media collection, hook and headers](task-2-media-collection.md) | strong | 1 | 2A 2B 2C | done |
| 3 | [The media door](task-3-media-door.md) | strong | 2 | 3A 3B | done |
| 4 | [Media in the properties panel and close-out](task-4-panel-closeout.md) | mid | 3 | 4A 4B 4C | done |

**Status values:** `not started`, `in progress`, `awaiting review`, `done`. Run tasks one at a time (implementers never run in parallel).

Names and signatures shared between tasks are in each task file's **Interfaces** block. If a task needs something its Interfaces block does not list, stop and report it; do not guess.

**Closing a checkpoint** follows the Plan 1 router, "Rules while working". Replace its `<date>-foundation` with `2026-11-16-media-upload`.

## Amendment 2026-11-20: storage belongs to the team lead

Decided by the developer during the whole-branch review. It replaces the parts of the plan below; the decision text above is kept as it was built.

- **Quota (replaces line 24, goal 5, the quota part of D1):** every `media` row in the projects of a team owner counts against **that owner's** quota (their `user_limits` override or the default), whoever uploaded it, in every project, removed or not. The race re-check adds up the owner's rows, not the uploader's.
- **Fields (amends D3):** `uploader` is optional (who uploaded; cleared when that account is deleted, so a member leaving or being deleted never strands or frees files). New `removed_at` (date). The update rule is `IS_MEMBER`, guarded by a hook: a member may only set `removed_at`; only the owner clears it (restore).
- **Who deletes (replaces D8):** a member can only **remove** a file (hide it for everyone; its space stays used). The team owner sees "Removed by the team" in the panel and can **restore** it or **delete it for good** (asks first, no `confirm()`, then the space is freed). `deleteRule` is owner only.
- **Storage route:** `GET /api/kwnto/storage?project=<id>` returns the owner's usage and quota for the project, plus `isLead`; a non-member gets 404. The meter reads "Team storage: ...".
- Migration `1794380100_media_team_quota.js`; design 5, 6.8 and 9, the ERD and backend.md are updated.

## Done when

- `npm test` passes on a clean clone with Docker running, and `npm run check:task` passed for every task (output in the reports).
- Every row above says `done`, no step box is unticked, `git status` is clean.
- [test-plan.md](../../../test-plan.md) row "Properties panel: media upload, quota, strict file checks" says `covered` for unit, rules and e2e; security.md section 4 and the "Malicious upload" row no longer say **(planned)**.
- The roadmap marks Plan 5 `done`; "large uploads through Funnel" is in the Plan 6 outline.
- A whole-branch review of `feat/media-upload` is complete and the developer has reviewed the branch. Agents do not merge or push.
