# Task 4: Sharing screens and the read-only viewer

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** Task 3

Design 5 and 8b: a member shares a project by link and revokes it; a view link opens without an account (an e2e test of that is required by design 8b); comment and edit links ask for a sign-in first. D8 says what each holder sees; D9 how a live view stays current.

**Files:**
- Create: `frontend/src/backend/shares.ts`, `frontend/src/backend/share-types.ts`, `frontend/src/backend/shares.test.ts`, `frontend/src/features/share/shareModel.ts`, `frontend/src/features/share/shareModel.test.ts`, `frontend/src/features/share/ShareDialog.tsx`, `frontend/src/features/share/LinkRow.tsx`, `frontend/src/features/share/ShareScreen.tsx`, `frontend/src/features/share/ReadOnlyViewer.tsx`, `frontend/src/features/share/ReadOnlyPanel.tsx`, `frontend/src/features/share/SharedWithMe.tsx`, `e2e/share-links.spec.ts`, `e2e/helpers/share.ts`
- Modify: `frontend/src/backend/client.ts`, `index.ts` (`shares`), `frontend/src/features/shell/routes.ts` and `routes.test.ts` (`#/s/<token>`), the shell (the share screen renders signed in or not; after a sign-in started from a link, return to it), the editor's tool strip or top bar (`Share`), `frontend/src/features/teams/TeamsScreen.tsx` (`SharedWithMe`), the editor's owner-only and team-only controls (they must not break for an edit-grant holder, who is not in the team), `docs/user/sharing.md` (new: making, copying, revoking and republishing links; what each kind of holder sees), `docs/README.md` (link it)

**Interfaces:**
- Consumes: the routes and grant behaviour of Task 3; `ProjectFile` (D5 shape; write its TypeScript type in `share-types.ts`, matching `docs/developer/project-file.md`); `ProjectContent` and `fromContent` (`model/state.ts`), the canvas's node and edge builders (`model/flow.ts`), `NodeCard` if it renders from plain props, else a small read-only card.
- Produces, `share-types.ts`: `SharePermission = 'view' | 'comment' | 'edit'`, `ShareKind = 'live' | 'snapshot'`, `ShareLink { id, projectId, token, permission, kind, revoked, created }`, `ShareOpen = { permission: 'view' | 'comment'; kind: ShareKind; projectId: string; projectName: string; file: ProjectFile } | { permission: 'edit'; projectId: string }`, `Grant { projectId, projectName, permission }`.
- Produces, door `backend.shares`: `list(projectId): Promise<ShareLink[]>` (not revoked first, newest first), `create(projectId, permission, kind): Promise<ShareLink>`, `revoke(id): Promise<void>`, `republish(id): Promise<ShareLink>`, `open(token): Promise<ShareOpen>` (401 and 403 become `BackendError` `forbidden` with the server's message; 404 `not-found`), `join(token): Promise<{ projectId: string; permission: SharePermission }>`, `mediaUrl(token, mediaId, thumb?): string`, `myGrants(): Promise<Grant[]>` (edit grants only: comment links are reopened through the link itself).
- Produces, `shareModel.ts`:

```ts
export function shareUrl(origin: string, token: string): string        // `${origin}/#/s/${token}`
export function contentFromFile(file: ProjectFile, projectId: string): ProjectContent // version 0, deleted false, the file's ids
export function shouldRefresh(kind: ShareKind, visible: boolean, lastMs: number, nowMs: number): boolean // live, visible and nowMs - lastMs >= 30000
export function permissionLabel(p: SharePermission, k: ShareKind): string // 'Can view (live)', 'Can view (snapshot)', 'Can comment', 'Can edit'
```

- Produces, routes: `{ name: 'share'; token: string }` from `#/s/<token>`, token `^[A-Za-z0-9]{40}$`.
- Produces, screens: `ShareDialog` (`role="dialog"`, title `Share <project name>`; a `Who can open it` select with `Can view`, `Can comment`, `Can edit`; a `Kind` select with `Live` and `Snapshot` (Snapshot only with `Can view`, D7); `Create link`; one `LinkRow` per link: `permissionLabel`, the date, `Copy link` (writes `shareUrl` to the clipboard and says `Copied`), `Republish` for a snapshot, `Revoke` with the router's question drawn in the row; revoked links listed greyed with `Revoked`). `ShareScreen`: opens the link; 401 shows the copy with `Sign in` (sign in, then come back to the link); 403 the copy; 404 the copy and nothing else; `edit`: `join`, then the project route; `comment`: `join`, then the viewer; `view`: the viewer. `ReadOnlyViewer`: the project name, chapter tabs, a canvas that pans and zooms but cannot change anything, a click on a node opens `ReadOnlyPanel` (title, script lines with character names, choices with their labels or target titles, media from `mediaUrl`: `<img>`, `<audio controls>`, `<video controls>`, or `Media removed` when the media URL answers 404; a slot under them for Task 5's comments). A live view re-reads on `shouldRefresh` (checked every 5 s) and on `visibilitychange`.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 4A: Door and model

- [ ] **Step 1: Write the failing tests** C1 in `shareModel.test.ts`, C2 in `shares.test.ts`, the route rows of C1 in `routes.test.ts`.
- [ ] **Step 2: Run** `npx vitest run --project unit frontend/src/features/share frontend/src/backend/shares.test.ts frontend/src/features/shell/routes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `share-types.ts`, `shares.ts`, `shareModel.ts` (`shouldRefresh` is `kind === 'live' && visible && nowMs - lastMs >= 30000`, B1) and the route (`/^[A-Za-z0-9]{40}$/`, B2).
- [ ] **Step 4: Run** them. Expected: PASS. **Close checkpoint 4A** (commit `feat: share door and model`).

## Checkpoint 4B: The share dialog and the link screen

- [ ] **Step 5: Write the failing tests** C3 to C6 in `e2e/share-links.spec.ts` (`e2e/helpers/share.ts`: `makeLink(page, permission, kind): Promise<string>` reads the copied URL; a fresh `browser.newContext()` is the person without an account).
- [ ] **Step 6: Run** `npm run test:e2e -- e2e/share-links.spec.ts`. Expected: FAIL.
- [ ] **Step 7: Implement** the dialog, the screen, the viewer and the panel. Theme tokens only (Plan 3 D1); no `confirm()`. The viewer never imports the editor store.
- [ ] **Step 8: Run** the spec. Expected: PASS. **Close checkpoint 4B** (commit `feat: share dialog and read-only viewer`).

## Checkpoint 4C: Edit links in the editor

- [ ] **Step 9: Write the failing tests** C7 and C8; run, expect FAIL.
- [ ] **Step 10: Implement** `SharedWithMe` and whatever the editor needs so an edit-grant holder can work: find every place the editor or shell reads the team, its members or the owner (for example `Back to teams`, owner-only menu items) and make each one treat "not a member" as "not the owner" instead of failing. List those places in the report.
- [ ] **Step 11: Run** `npm run test:unit` and `npm run test:e2e`. Expected: PASS. Write `docs/user/sharing.md`. **Close checkpoint 4C** (commit `feat: edit links open the editor`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | share model and route | unit | `shareUrl('https://a', 'T')`; `contentFromFile` of a 2-chapter file; `shouldRefresh` live visible at 29,999 and 30,000 ms, hidden, snapshot; `permissionLabel` of the four; `#/s/` + 40 letters, + 39, + 40 with a `-` | `https://a/#/s/T`; content with both chapters, `deleted` false, `version` 0, ids kept; false, true, false, false; the four labels; the share route, `teams`, `teams` | frontend/src/features/share/shareModel.test.ts :: links, refreshes and the viewer's content follow the link's kind |
| C2 | door errors | unit | fake answers 401, 403, 404 to `open` | `forbidden` with `Sign in to open this shared project.`; `forbidden` with the verify copy; `not-found` with the bad-link copy | frontend/src/backend/shares.test.ts :: the door passes the server's link messages on |
| C3 | a view link without an account (design 8b) | e2e | the owner makes a live view link of a project with 2 nodes, a choice and an image; a fresh context opens it | the project name, both nodes and the choice line; clicking a node shows its lines and the image (`naturalWidth` 1); no editing control (no tool strip, no `Add node`, inputs absent) | e2e/share-links.spec.ts :: a view link shows the project and its media without an account |
| C4 | live and snapshot | e2e | live view link and snapshot link open in a fresh context; the owner adds node `Late`; the viewer's tab is hidden and shown again; the owner republishes the snapshot | the live view shows `Late` after becoming visible (no reload); the snapshot does not until republished and reloaded | e2e/share-links.spec.ts :: a live link follows the project and a snapshot only when republished |
| C5 | revoke | e2e | revoke the view link in the dialog (`Cancel` once, then `Revoke`); the viewer reloads | no browser dialog; the row reads `Revoked`; the viewer shows only `This link is not valid or was revoked.` | e2e/share-links.spec.ts :: a revoked link stops working at once |
| C6 | comment link needs a sign-in | e2e | a comment link opened in a fresh context; `Sign in` with a verified account | the sign-in copy; after signing in the viewer opens on that project | e2e/share-links.spec.ts :: a comment link asks for a sign-in and returns to the project |
| C7 | edit link | e2e | the owner makes an edit link; a verified non-member opens it; renames a node; the owner's editor; the holder's teams page | the editor opens for that project; the owner sees the rename live; the holder's `Shared with me` lists the project; no `Move to trash` for the project and no team controls | e2e/share-links.spec.ts :: an edit link lets a non-member edit that one project |
| C8 | edit link revoked while open | e2e | the holder is editing; the owner revokes the link; the holder renames a node | the holder's change is refused with a message (the failed list of Plan 4 or the error banner), it does not appear for the owner, and `Shared with me` no longer lists the project after a reload | e2e/share-links.spec.ts :: revoking an edit link stops an open editor's saves |
### Probes
**Probe folder:** `tests/probes/2026-11-20-sharing/task-4/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/share/shareModel.ts | `nowMs - lastMs >= 30000` | `nowMs - lastMs > 30000` | frontend/src/features/share/shareModel.test.ts |
| B2 | frontend/src/features/shell/routes.ts | `/^[A-Za-z0-9]{40}$/` | `/^[A-Za-z0-9-]{39,40}$/` | frontend/src/features/shell/routes.test.ts |
### Flow
In Firefox and Chromium: make one link of each kind; open each in a private window (view without an account; comment and edit after signing in with a second account); revoke each while it is open. Record what you saw in `progress.md`.
### Evidence
The full output of `npm run check:task`, the list of places changed in Step 10, the failing run of each break, and the Flow record.
