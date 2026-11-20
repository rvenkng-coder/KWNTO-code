# Task 3: Share links on the server

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Task 2

Design 5 and security.md 2: share links at three levels (view, comment, edit), live or snapshot, revocable; view links work without an account and include media; comment and edit links need a verified sign-in; an edit link grants one project, never the team. The most security-sensitive task of the plan: every rule and route here has tests for member, outsider, signed-out, each link level and a revoked link.

**Files:**
- Create: `backend/pb_hooks/lib/share.js`, `tests/hooks/share.unit.test.ts`, `backend/pb_migrations/1794400000_share_links.js`, `backend/pb_migrations/1794400100_link_grants_rules.js`, `backend/pb_hooks/share.pb.js`, `tests/rules/share_links.rules.test.ts`, `tests/rules/link_grants.rules.test.ts`, `tests/rules/share-routes.rules.test.ts`, `tests/rules/share-access.rules.test.ts`, `tests/rules/helpers/share.ts`
- Modify: `backend/pb_hooks/admin-controls.pb.js` (the revoke-all route), `docs/security.md` (section 2: built; section 9 control 6 in the runbook's form: When, Steps with the `curl` line, Confirm, Undo "none: make new links"), `docs/developer/backend.md` (collections, routes, "Edit grants in rules"), the ERD (`share_links`: `created_by` optional, `token` 40 characters, D7; new `link_grants`)

**Interfaces:**
- Consumes: `buildProjectFile`, `validateProjectFile`, `FILE_LIMITS` (Task 2); `logEvent` (`lib/security-log.js`); the Plan 5 media download headers (`media.pb.js`, D6 there); `memberProject`, `createNode`, `guardedUpdate`, `readAsAdmin`, `clientId` (content helpers); `uploadMedia`, `PNG_1PX` (media helpers); `createUser`, `asUser`, `asAnonymous`, `adminSend`, `rawSend` (`helpers/pb.ts`); `unverifiedUser` (`helpers/invites.ts`).
- Produces, collection `share_links`: `project` (relation, cascade), `created_by` (relation users, optional, not cascade), `token` (text, 40, unique index), `permission` (select `view`, `comment`, `edit`), `kind` (select `live`, `snapshot`), `revoked` (bool), `snapshot_data` (json, `maxSize` 6291456), `created`, `updated`. Rules: list and view `IS_MEMBER`; create `IS_MEMBER && @request.auth.verified = true && @request.body.created_by = @request.auth.id` plus `:isset = false` for `token`, `revoked`, `snapshot_data`, plus `(@request.body.kind = 'live' || @request.body.permission = 'view')` (D7); update `IS_MEMBER && @request.body.revoked = true` plus `:isset = false` for every other field; delete `null`. A create hook sets `token` and, for a snapshot, `snapshot_data = buildProjectFile(<the project's records>, now)`, with the insert outside any transaction of ours (live create events, backend.md).
- Produces, collection `link_grants`: `link` (relation `share_links`, cascade), `user` (relation users, cascade), `project` (relation, cascade), `permission` (select `comment`, `edit`), `project_name` (text, copied when made), `created`; unique index on (`link`, `user`). Rules: list and view `user = @request.auth.id && link.revoked = false`; create, update, delete `null` (the join route makes them).
- Produces, `lib/share.js` (CommonJS):

```js
// link: { revoked, permission, kind } or null; projectTrashed: boolean; caller: { signedIn, verified }
// view links: 200 'view' for anyone. comment and edit: 401 signed out, 403 unverified, else 200 with the permission.
// A missing or revoked link, or a trashed project: 404, whoever asks.
function shareAccess(link, projectTrashed, caller) -> { status: 200 | 401 | 403 | 404, mode: 'view' | 'comment' | 'edit' | null }
function snapshotMediaIds(snapshotData) -> string[]   // ids in snapshotData.media; [] for anything malformed
module.exports = { shareAccess, snapshotMediaIds }
```

- Produces, routes (`share.pb.js`; every token looked up with `findFirstRecordByFilter("share_links", "token = {:t}", { t })`; a 404 body is always `{ "message": "This link is not valid or was revoked." }`):
  - `GET /api/kwnto/share/{token}`: per `shareAccess`. 401 `Sign in to open this shared project.`; 403 `Verify your email to open this shared project.`; 200 for `view` and `comment`: `{ permission, kind, projectId, projectName, file }` (`file` is `snapshot_data` for a snapshot, else built now); 200 for `edit`: `{ permission: 'edit', projectId }` and nothing else.
  - `POST /api/kwnto/share/{token}/join`: signed in and verified, link `comment` or `edit`: makes (or finds) the caller's grant; 200 `{ projectId, permission }`. A view link: 404 as above. A team member gets 200 with no grant made.
  - `GET /api/kwnto/share/{token}/media/{mediaId}` (query `thumb` passed on): for `view` and `comment` (the same 401 and 403 as above for comment links, the caller's token in the `Authorization` header); the media must be in the link's project with an empty `removed_at`, and for a snapshot be in `snapshotMediaIds`; else the 404. Served with the Plan 5 headers.
  - `POST /api/kwnto/share-links/{id}/republish`: a member, the link a snapshot and not revoked: `snapshot_data` rebuilt, 200 the link; a live link 400 `Only a snapshot can be republished.`; a revoked one 404.
  - `POST /api/kwnto/admin/share-links/revoke-all` (`requireSuperuserAuth`): every link `revoked = true`, logs `admin` with `detail.action` `revoke-all-links` and `detail.count`; 200 `{ count }`.
- Produces, the edit grant in rules (migration `1794400100`): `EDIT_GRANT(projectField)` = `(@request.auth.verified = true && @collection.link_grants:grant.user ?= @request.auth.id && @collection.link_grants:grant.project ?= <projectField> && @collection.link_grants:grant.permission ?= 'edit' && @collection.link_grants:grant.link.revoked ?= false)`, where `<projectField>` is `id` for `projects` and `project` elsewhere. The migration replaces the exact membership fragment `<IS_MEMBER>` with `(<IS_MEMBER> || <EDIT_GRANT>)` in: list, view and update rules of `projects`, `project_settings`, `chapters`, `nodes`, `script_lines`, `cues`, `connections`; create and delete rules of `chapters`, `nodes`, `script_lines`, `cues`, `connections`; list, view, create and update rules of `media`. It throws (naming the collection and rule) if the fragment is not found exactly once. Owner-only parts (`team.owner = @request.auth.id`) are untouched, so a grant holder never trashes the project or deletes media for good. The down migration puts the old rules back.
- Produces, `tests/rules/helpers/share.ts`:

```ts
export function createLink(user: TestUser, projectId: string, permission: 'view' | 'comment' | 'edit', kind: 'live' | 'snapshot'): Promise<{ id: string; token: string }>
export function revokeLink(user: TestUser, linkId: string): Promise<void>
export function openShare(token: string, user?: TestUser): Promise<Reply>     // GET /api/kwnto/share/{token}
export function joinShare(token: string, user: TestUser): Promise<Reply>
export function shareMedia(token: string, mediaId: string, user?: TestUser): Promise<Response>
```

**If interrupted:** the rules suite runs on a throwaway backend; nothing persists.

## Checkpoint 3A: Links and the access decision

- [ ] **Step 1: Write the failing tests** C1 in `tests/hooks/share.unit.test.ts`, C2 and C3 in `share_links.rules.test.ts`, C4 in `link_grants.rules.test.ts`, with the helper.
- [ ] **Step 2: Run** `npx vitest run --project unit tests/hooks/share.unit.test.ts` and `npm run test:rules -- tests/rules/share_links.rules.test.ts tests/rules/link_grants.rules.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `lib/share.js` (the first line is `if (link === null || link.revoked || projectTrashed) return NOT_FOUND`, B1; the sign-in branch `if (link.permission !== 'view' && !caller.signedIn)`, B2; the verified branch `if (link.permission !== 'view' && !caller.verified)`, B3), migration `1794400000` (both collections) and the create hook.
- [ ] **Step 4: Run** them. Open the `share_links` create rule once: C2 must fail; restore. Expected: PASS. **Close checkpoint 3A** (commit `feat: share links and grants`).

## Checkpoint 3B: The routes

- [ ] **Step 5: Confirm** in 0.40.6 `types.d.ts` how a route serves a stored file (`e.app.newFilesystem()`, `fs.serve(res, req, key, name)`, `record.baseFilesPath()`), and that thumbs can be served the same way; record it in `progress.md`. If serving is not possible from a route, stop and report (D8 needs another way for media).
- [ ] **Step 6: Write the failing tests** C5 to C7 in `share-routes.rules.test.ts`; run, expect FAIL.
- [ ] **Step 7: Implement** `share.pb.js` and the revoke-all route.
- [ ] **Step 8: Run** `npm run test:rules`. Expected: PASS. **Close checkpoint 3B** (commit `feat: share routes for view, comment and edit links`).

## Checkpoint 3C: Edit grants in the content rules

- [ ] **Step 9: Write the failing tests** C8 and C9 in `share-access.rules.test.ts`; run, expect FAIL.
- [ ] **Step 10: Write migration `1794400100`.** Then confirm the alias joins one grant row: C9's mixed case must pass; if it fails, the aliases do not do what D2 needs, stop and report.
- [ ] **Step 11: Run** `npm run test:rules` and `npm run test:e2e`. Expected: PASS, every existing rule test unchanged. Open the grant once (drop `grant.permission ?= 'edit'`): C8's comment-link row must fail; restore. Write runbook control 6 and the docs. **Close checkpoint 3C** (commit `feat: edit links reach one project through grants`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | the access decision | unit | `null`; a revoked view link; a view link of a trashed project; a view link signed out; a comment link signed out, signed in unverified, verified; an edit link the same three ways; `snapshotMediaIds` of a file with 2 media, of `null`, of `{ media: 'x' }` | 404 ×3; 200 view; 401, 403, 200 comment; 401, 403, 200 edit; the two ids, `[]`, `[]` | tests/hooks/share.unit.test.ts :: who gets in through a link is decided by the link, the project and the caller |
| C2 | who makes links | rules | a verified member makes a live edit link and a snapshot view link; an unverified member; an outsider; signed out; a member sending `token`, `revoked` or `snapshot_data`; `created_by` another user; a snapshot `edit` link | the two made, each with a 40-character `[A-Za-z0-9]` token, the snapshot with `snapshot_data.format` `kwnto-project`; every other attempt refused and no row made | tests/rules/share_links.rules.test.ts :: only a verified member makes a link and the server makes its token |
| C3 | who sees and revokes links | rules | member lists; outsider lists and views by id; an edit-grant holder lists; a member PATCHes `revoked: true`; then `revoked: false`; a member PATCHes `permission`; anyone deletes | member sees the links; outsider and grant holder empty / 404; revoke works; un-revoke, permission change and delete refused | tests/rules/share_links.rules.test.ts :: members see and revoke links and nobody edits or deletes them |
| C4 | grants are private and made by the server | rules | a user with a grant lists grants; another user lists; anyone creates, updates or deletes a grant through the API; the link is revoked, then the holder lists | own grant only, with `project_name`; the other sees none; all writes refused; after revoking the holder's list is empty | tests/rules/link_grants.rules.test.ts :: grants are made only by the server and seen only by their holder |
| C5 | the view route | rules | a live view link opened signed out; a node added after, opened again; a snapshot view link opened, the project edited, opened again, republished, opened again; a revoked link; a token `' OR 1=1 --`; a random 40-character token; a link of a trashed project | live: the file with the node; second open shows the new node; snapshot: unchanged until republished, then changed; the last four 404 with identical status, headers `Content-Type` and body | tests/rules/share-routes.rules.test.ts :: a view link shows the project to anyone until it is revoked |
| C6 | media through a link | rules | an image on a node; through a live view link signed out; the same media after the link is revoked; a media id of another project; a removed media; through a snapshot link after the file is deleted for good | the 67 bytes with `X-Content-Type-Options: nosniff` and Plan 5's CSP; then 404; 404; 404; 404 | tests/rules/share-routes.rules.test.ts :: link holders get the project's media and nothing else |
| C7 | comment and edit links | rules | a comment link: `openShare` signed out, unverified, verified; `joinShare` verified twice; an edit link: `openShare` verified (no file in the body), `joinShare`; a view link `joinShare`; a team member joins an edit link; `republish` of a live link | 401 and 403 with the copy; 200 with the file; one grant (admin count 1); `{ permission: 'edit', projectId }` only; a grant; 404; 200 and no grant; 400 copy | tests/rules/share-routes.rules.test.ts :: comment and edit links need a verified sign-in and make one grant |
| C8 | an edit grant reaches one project only | rules | an edit-grant holder: reads and edits a node, adds a line, uploads media, reads the project; reads the team, team members, team settings, another project of the team; trashes the project; deletes media for good; a comment-grant holder edits a node; after revoking, the edit-grant holder edits again and its open subscription | node, line, upload and project read work; team, members, settings, other project: empty or 404; trash and delete refused; comment-grant edit refused; after revoking every write refused and no further live event arrives | tests/rules/share-access.rules.test.ts :: an edit link opens one project, never the team, until revoked |
| C9 | grants do not mix across rows | rules | a person with a comment grant on project A and an edit grant on project B edits a node of A; a person with an edit grant on A whose link for A is revoked and a live edit grant on B | refused; refused on A, allowed on B | tests/rules/share-access.rules.test.ts :: one grant row decides, never parts of two |
| C10 | revoke all (incident control 6) | rules | 3 links in 2 teams; a member calls the admin route; the admin calls it | 401 or 403; 200 `{ count: 3 }`; all three revoked; an `admin` log entry with `revoke-all-links` | tests/rules/share-routes.rules.test.ts :: the admin revokes every link at once |
### Probes
**Probe folder:** `tests/probes/2026-11-20-sharing/task-3/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | backend/pb_hooks/lib/share.js | `if (link === null \|\| link.revoked \|\| projectTrashed) return NOT_FOUND` | `if (link === null) return NOT_FOUND` | tests/hooks/share.unit.test.ts |
| B2 | backend/pb_hooks/lib/share.js | `if (link.permission !== 'view' && !caller.signedIn)` | `if (link.permission === 'edit' && !caller.signedIn)` | tests/hooks/share.unit.test.ts |
| B3 | backend/pb_hooks/lib/share.js | `if (link.permission !== 'view' && !caller.verified)` | `if (false)` | tests/hooks/share.unit.test.ts |
### Flow
none (the screens are Task 4)
### Evidence
The full output of `npm run check:task`, the two rule-opening runs (Steps 4 and 11), the Step 5 and Step 10 findings, and the failing run of each break.
