# Task 2: The media collection, hook and headers

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Task 1

The server half of design 6.2 and security.md section 4: who may upload, read and delete (D3, D8), the strict check, size limits and quota inside one transaction (D1, Review Focus 1), generated names (D4), safe headers (D6) and the caller's own usage (D10). Rule tests are "the most important layer" (design 8b), and they are the second half of security.md's "malicious upload" check.

**Files:**
- Create: `backend/pb_migrations/1794380000_media.js`, `backend/pb_hooks/media.pb.js`, `tests/rules/media.rules.test.ts`, `tests/rules/media.limits.rules.test.ts`, `tests/rules/helpers/media.ts`
- Modify: `backend/pb_hooks/lib/settings.js` (`getSystemStorage`), `docs/developer/backend.md` (hooks table, a "Media uploads" section, the route), `docs/superpowers/specs/2026-11-11-kwnto-erd.md` (`media`: `title`, protected file, rules), `docs/admin/settings.md` (how each `system_storage` value and `quota_override_bytes` is used; the 1 GiB ceiling)

**Interfaces:**
- Consumes: `checkUpload`, `quotaFor`, `kindOf`, `MIB` (Task 1); `memberProject`, `createNode`, `guardedUpdate`, `clientId` (`tests/rules/helpers/content.ts`); `createUser`, `asUser`, `asAnonymous`, `adminSend`, `rawSend`, `createTeam`, `PB_URL` (`tests/rules/helpers/pb.ts`); `addMember` (`tests/rules/helpers/teams.ts`).
- Produces, `lib/settings.js`: `getSystemStorage(app) -> { defaultQuotaBytes, maxMb: { audio, video, image }, allowedTypes: string[] }` (reads `max_audio_mb`, `max_video_mb`, `max_image_mb`; throws if the record is missing, like the others).
- Produces, collection `media` (D3): fields `project`, `node`, `uploader`, `file` (`protected: true`, `maxSelect: 1`, `maxSize: 1073741824`), `title`, `kind` (select `audio`, `video`, `image`), `size_bytes` (number, `onlyInt`, `min: 0`), `created`. Rules: list and view `IS_MEMBER` (as in `1794370100_nodes_lines_connections.js`); create `IS_MEMBER && @request.auth.verified = true && @request.body.uploader = @request.auth.id && @request.body.node.project = @request.body.project` plus `@request.body.<f>:isset = false` for `kind`, `size_bytes`, `title`; update `null`; delete `IS_MEMBER`.
- Produces, the refusal body (D2): HTTP 400 `{ "message": <copy>, "data": { "file": { "code": <code>, "message": <copy> } } }`.
- Produces, route `GET /api/kwnto/storage` (D10): `{ usedBytes: number, quotaBytes: number, maxBytes: { audio: number, video: number, image: number }, allowedTypes: string[] }`; 401 signed out, 403 unverified.
- Produces, `tests/rules/helpers/media.ts`:

```ts
export const PNG_1PX: Uint8Array                 // a valid 1x1 PNG (67 bytes)
export function sampleBytes(type: 'wav' | 'mp3' | 'mov' | 'mp4' | 'jpeg' | 'png' | 'html' | 'zeros', size: number): Uint8Array // the type's first bytes, padded to size
export function uploadMedia(user: TestUser, fields: { project: string; node: string; uploader?: string }, file: { name: string; bytes: Uint8Array }): Promise<Response>
export function setQuotaOverride(userId: string, bytes: number): Promise<void>      // admin, user_limits
export function setStorageSetting(field: string, value: unknown): Promise<() => Promise<void>>  // admin; returns the restore function for afterEach
```

**If interrupted:** the rules suite runs on a throwaway backend (`compose.test.yaml`, data in memory); nothing persists.

## Checkpoint 2A: The collection and its rules

- [x] **Step 1: Write the failing tests** C1 to C4 and C11 in `tests/rules/media.rules.test.ts`, with `tests/rules/helpers/media.ts`.
- [x] **Step 2: Run** `npm run test:rules -- tests/rules/media.rules.test.ts`. Expected: FAIL (no collection).
- [x] **Step 3: Write the migration** `1794380000_media.js` with the fields and rules above (the down migration deletes the collection).
- [x] **Step 4: Run** it. Expected: C1 fails only on the generated name and `title` (the hook comes in 2B); the rest PASS. Then open the create rule once to `@request.auth.id != ''`: C2 must fail; restore it and say so in the report.
- [x] **Step 5: Close checkpoint 2A** after C2 to C4 and C11 pass (commit `feat: media collection and access rules`). C1 stays red until 2B; write that in the `progress.md` row.

## Checkpoint 2B: The upload hook

- [x] **Step 6: Confirm the JS hook API** in 0.40.6 before writing the hook: start the dev backend and read `/pb/pb_data/types.d.ts` inside the container (`docker compose -f compose.dev.yaml exec pocketbase grep -n "toBytes\|interface File\b\|originalName\|findUploadedFiles" /pb/pb_data/types.d.ts`). Find whether the `onRecordCreate` model hook can reach the uploaded file before `e.next()` (`e.record.get("file")`), or only the request hook can (`e.findUploadedFiles("file")`; then D1's fallback applies), how to read its first 16 bytes (`file.reader.open()` with `toBytes(reader, 16)`), and whether assigning `file.name` changes the stored name. Write the findings in the checkpoint's `progress.md` row. If the first bytes cannot be read from a hook, stop and report: D1 needs another place.
- [x] **Step 7: Write the failing tests** C5, C7, C8, C9 in `tests/rules/media.limits.rules.test.ts` (settings restored in `afterEach`; quota through a per-user override, so other files are not affected).
- [x] **Step 8: Run** `npm run test:rules -- tests/rules/media.limits.rules.test.ts`. Expected: FAIL.
- [x] **Step 9: Write `media.pb.js`'s create hook** (D1). **Before `e.next()`:** read the file and its first 16 bytes; sum `size_bytes` of the uploader's `media` rows (one SQL `SELECT COALESCE(SUM(size_bytes), 0)` bound to the user id); `quotaFor` from `getSystemStorage(e.app)` and the user's `user_limits` row; `checkUpload`; on a problem throw `new BadRequestError(message, { file: new ValidationError(code, message) })` (check in Step 6 that this gives the D2 body; otherwise build it as the findings say); else set `kind`, `size_bytes`, `title` (the uploaded name, trimmed to 120 characters) and rename the file (D4, `$security.randomStringWithAlphabet(15, "abcdefghijklmnopqrstuvwxyz0123456789")`). **Then `e.next()`, never inside a transaction of ours** (do not write `e.app = txApp`). **After it**, in `e.app.runInTransaction((txApp) => { … })`: read the uploader's rows (`id`, `created`, `size_bytes`) and, if `usedThrough(rows, e.record.id)` is over the quota, delete `e.record` with `txApp` and throw the over-quota error built by `checkUpload` (with `usedBytes` = the sum before this file).
- [x] **Step 10: Run** `npm run test:rules`. Expected: PASS, C1 included. Run C9 ten times (`--repeat-each` is not a Vitest flag: loop the command 10 times) and record that it passed 10 of 10. **Close checkpoint 2B** (commit `feat: strict upload checks, size limits and quota`).

## Checkpoint 2C: Headers and the usage route

- [x] **Step 11: Write the failing tests** C6 and C10 in `tests/rules/media.rules.test.ts`.
- [x] **Step 12: Run** them. Expected: FAIL.
- [x] **Step 13: Implement** the `onFileDownloadRequest` hook for `media` (D6; `Content-Type` from the stored extension: `audio/wav`, `audio/mpeg`, `video/quicktime`, `video/mp4`, `image/jpeg`, `image/png`) and the route (D10) with `$apis.requireAuth("users")` and its own `e.auth.verified()` check, as `teams-join.pb.js` does.
- [x] **Step 14: Run** `npm run test:rules` and `npm run test:unit`. Expected: PASS. Update `backend.md`, the ERD and `docs/admin/settings.md`. **Close checkpoint 2C** (commit `feat: safe media headers and the storage route`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | member uploads | rules | verified member uploads `PNG_1PX` as `My Photo.png` to a node of the project | 200; `kind` image, `size_bytes` 67, `uploader` the member, `title` `My Photo.png`; stored name matches `^[a-z0-9]{15}\.png$` and does not contain `Photo` | tests/rules/media.rules.test.ts :: a member uploads an image and the server names it |
| C2 | wrong actors and forged fields | rules | signed-out; verified outsider; unverified member; member with `uploader` set to the owner; member with a node of another project; member sending `kind`, `size_bytes` or `title` | refused every time; no `media` row made (admin count) | tests/rules/media.rules.test.ts :: only a verified member uploads, as themself, into their own project |
| C3 | reading files | rules | member lists and views; outsider lists and views; file URL with no token; with the outsider's file token; with the member's token | member sees the row and gets the 67 bytes; outsider: empty list, 404 view; no token and outsider token: not 200 and no bytes | tests/rules/media.rules.test.ts :: only the team can read a media row or its file |
| C4 | update and delete | rules | member PATCHes `title`; outsider deletes; signed-out deletes; another member deletes | update refused; outsider and signed-out refused; member delete 204 and the file URL no longer serves | tests/rules/media.rules.test.ts :: media is never edited and only members delete it |
| C5 | strict check on the server | rules | PNG bytes as `song.mp3`; HTML as `photo.jpg`; zeros as `a.wav`; a `.gif`; a real MP3 header as `a.mp3` | 400 with `data.file.code` `media_not_real` (×3, messages from the router), `media_type_not_allowed`; the MP3 200 with `kind` audio; refused ones leave no row | tests/rules/media.limits.rules.test.ts :: a file whose bytes do not match is refused on the server |
| C6 | safe headers | rules | the member downloads a stored PNG; then a "polyglot" (PNG signature followed by `<script>alert(1)</script>`, named `x.png`) | `X-Content-Type-Options: nosniff`; `Content-Type: image/png`; CSP contains `default-src 'none'` and `sandbox`, for both | tests/rules/media.rules.test.ts :: stored files are served so they cannot run as a page |
| C7 | trashed media still counts | rules | override 1000; upload 600 to node N; trash N (guarded update); upload 600 to another node | the second is refused `media_over_quota` | tests/rules/media.limits.rules.test.ts :: files under a trashed node still count toward the quota |
| C8 | limits are read at run time | rules | override 1000: 600 ok, 600 refused with `Not enough storage: this file is 1 KB and you have 1 KB of 1 KB left. Nothing was deleted.`; admin sets override 2000: 600 ok; admin sets `max_image_mb` 1: a 1 MiB + 1 byte PNG refused `This image file is larger than the 1 MB limit.` | as listed, without a restart | tests/rules/media.limits.rules.test.ts :: quota and size limits follow the admin's settings |
| C9 | parallel uploads and the quota | rules | override 1000; the same member sends two 600-byte PNG uploads at once | exactly one 200 and one 400 `media_over_quota`; one row; used bytes 600; `GET /api/kwnto/storage` agrees | tests/rules/media.limits.rules.test.ts :: two uploads at once cannot both slip under the quota |
| C10 | usage route | rules | member with 2 files (67 + 600) and override 0; signed-out; unverified | `usedBytes` 667, `quotaBytes` 2147483648, `maxBytes.video` 209715200, `allowedTypes` the six; 401; 403 | tests/rules/media.rules.test.ts :: the storage route tells a person only their own usage and limits |
| C11 | team delete removes media | rules | owner uploads, then deletes the team | the `media` row is gone (admin read 404) | tests/rules/media.rules.test.ts :: deleting a team removes its media |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
none
### Evidence
The full output of `npm run check:task`, the Step 4 rule-opening run, the Step 6 findings, and the 10 runs of C9.
