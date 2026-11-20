# Task 4: Media in the properties panel and close-out

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** Task 3

Design 6.2: the properties panel of a node lists its uploaded media and adds new files. Audio and video play in place, and images show as thumbnails. Every refusal shows the server's words (D2), the person sees how much space is left (Review Focus 5), uploads wait for the connection (D9), and deleting asks first (D8). Then the plan's paperwork.

**Files:**
- Create: `frontend/src/features/editor/media/mediaList.ts`, `frontend/src/features/editor/media/mediaList.test.ts`, `frontend/src/features/editor/media/useProjectMedia.ts`, `frontend/src/features/editor/media/MediaSection.tsx`, `frontend/src/features/editor/media/MediaItem.tsx`, `frontend/src/features/editor/media/StorageMeter.tsx`, `e2e/editor-media.spec.ts`, `e2e/helpers/media.ts`
- Modify: `frontend/src/features/editor/panel/NodeFields.tsx` (the panel of one selected node, after the editor cards plan: `MediaSection` between `Cues` and `Choices`), `frontend/src/features/editor/EditorScreen.tsx` (opens and closes `useProjectMedia` with the project), `docs/user/editor.md` ("Media"), `docs/security.md` (section 4 and the "Malicious upload" row: built, with the tests named), `docs/test-plan.md` (row "Properties panel: media upload, quota, strict file checks" `covered`: unit, rules, e2e), `docs/superpowers/plans/README.md` (Plan 5 `done`; "large uploads through Funnel" and the D12 progress-bar follow-up in the Plan 6 outline; a "Carried over from Plan 5" table for anything left out), `docs/README.md` (link the user section if it lists sections)

**Interfaces:**
- Consumes: `backend.media` (`list`, `upload`, `remove`, `storage`, `fileUrl`, `fileToken`, `subscribe`), `Media`, `MediaEvent`, `StorageInfo` (Task 3); `earlyProblem`, `formatSize` (Task 3); `useSelection` (Plan 3 Task 10); the panel of Plan 3 Task 11; `ownerWithProject` and the join-by-code helpers (Plan 3 and Plan 2 e2e helpers); `adminSend` style admin calls for `user_limits` (`e2e/helpers/admin.ts`).
- Produces, `media/mediaList.ts`:

```ts
export function applyMediaEvent(list: Media[], event: MediaEvent): Media[]   // create: append unless the id is there (our own echo); delete: drop; by `created`
export function mediaOf(list: Media[], nodeId: string): Media[]
export function meterText(info: StorageInfo): string                         // 'Storage: <used> of <quota> used' with formatSize
```

- Produces, `media/useProjectMedia.ts`: `useProjectMedia(projectId: string | null): { media: Media[]; storage: StorageInfo | null; uploading: string[]; error: string | null; upload(nodeId: string, file: File): Promise<void>; remove(m: Media): Promise<void> }` (loads `list` and `storage` and subscribes when the project opens; `upload` runs `earlyProblem` first, then `backend.media.upload`, then refreshes `storage`; an `unreachable` error shows the router's offline copy).
- Produces, screen: a `Media` heading; an `Add media` file input (`accept=".wav,.mp3,.mov,.mp4,.jpg,.jpeg,.png"`, label `Add media`, disabled while `navigator.onLine` is false, with the offline copy beside it); `Uploading <title>…` while a file is sent; one `MediaItem` per file (`data-testid="media-item"`: an `<img>` thumbnail (`thumb` `100x100`), an `<audio controls>` or a `<video controls>`, the `title` as text, its size, a `Delete` button with the D8 confirm); the error in `role="alert"`; `StorageMeter` (`data-testid="storage-meter"`, `meterText`).

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 4A: The list logic

- [x] **Step 1: Write the failing tests** C1 in `mediaList.test.ts`.
- [x] **Step 2: Run** `npx vitest run --project unit frontend/src/features/editor/media/mediaList.test.ts`. Expected: FAIL.
- [x] **Step 3: Implement** `mediaList.ts`. The echo rule is the line `if (list.some((m) => m.id === event.record.id)) return list` (B1).
- [x] **Step 4: Run** it. Expected: PASS. **Close checkpoint 4A** (commit `feat: media list helpers`).

## Checkpoint 4B: The panel section

- [x] **Step 5: Write the failing tests** C2 to C9 in `e2e/editor-media.spec.ts`. `e2e/helpers/media.ts` holds `PNG_1PX` and `sampleBytes` for `setInputFiles({ name, mimeType, buffer })` (the same bytes as the rules helper; do not import across `tests/` and `e2e/`) and `setQuotaOverride(email, bytes)` through the admin API.
- [x] **Step 6: Run** `npm run test:e2e -- e2e/editor-media.spec.ts`. Expected: FAIL.
- [x] **Step 7: Implement** `useProjectMedia.ts`, `MediaSection.tsx`, `MediaItem.tsx`, `StorageMeter.tsx` and the two modified screens. Colours and spacing from the theme tokens only (Plan 3 D1). Media URLs come only from `backend.media.fileUrl`.
- [x] **Step 8: Run** `npm run test:unit` and `npm run test:e2e`. Expected: PASS. **Close checkpoint 4B** (commit `feat: media in the properties panel`).

## Checkpoint 4C: Walk and close-out

- [x] **Step 9: Walk the Flow** below and record it in `progress.md`.
- [x] **Step 10: Update the docs** listed under **Files**.
- [x] **Step 11: Run** `npm test` and `npm run check:docs`. Expected: PASS. **Close checkpoint 4C** (commit `docs: close the media upload plan`). The whole-branch review follows; it is not part of this task.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | list helpers | unit | create event of a new file; the same create again (our echo); delete; `mediaOf` for a node; `meterText` with 67 used of 2147483648 | appended once; dropped; only that node's files by `created`; `Storage: 1 KB of 2.0 GB used` | frontend/src/features/editor/media/mediaList.test.ts :: the media list takes events once and filters by node |
| C2 | upload an image | e2e | select a node, `Add media` with `PNG_1PX` as `a.png`; reload | one `media-item` with an `<img>` that loads (`naturalWidth` 1) and the text `a.png`; still there after reload | e2e/editor-media.spec.ts :: an uploaded image shows on its node and stays after reload |
| C3 | audio and video players | e2e | upload `sampleBytes('mp3')` as `line.mp3` and `sampleBytes('mp4')` as `clip.mp4` | one item with `<audio controls>`, one with `<video controls>`, each `src` from the file URL with a `token` | e2e/editor-media.spec.ts :: audio and video files get players |
| C4 | renamed file refused by the server | e2e | PNG bytes as `song.mp3` | alert `This file is not a real MP3 file.`; no new item; the meter unchanged | e2e/editor-media.spec.ts :: a file whose contents do not match is refused with a clear message |
| C5 | early refusal sends nothing | e2e | a `.gif` file | alert `This file type is not allowed. Allowed: WAV, MP3, MOV, MP4, JPEG, PNG.`; no request to `/api/collections/media/records` | e2e/editor-media.spec.ts :: a file the browser can already refuse is never sent |
| C6 | over quota | e2e | admin sets the person's override to 100 bytes; upload `PNG_1PX`; upload it again | first ok; second alert `Not enough storage: this file is 1 KB and you have 1 KB of 1 KB left. Nothing was deleted.`; the first file still there; meter `Storage: 1 KB of 1 KB used` | e2e/editor-media.spec.ts :: over the quota an upload is refused and nothing is deleted |
| C7 | remove asks, hides, keeps space; the lead restores or deletes for good (amendment 2026-11-20, replaces delete-asks-and-frees-space) | e2e | upload `a.png`; `Remove`; the item asks `Remove a.png from this node? The team lead can bring it back.`; `Cancel`; `Remove` again, then `Remove` in the question; `Restore`; remove again; `Delete for good`, then `Delete for good` in the question | no browser dialog fires; after `Cancel` the item stays; after removing it leaves the node, shows under "Removed by the team" and the meter is unchanged; `Restore` brings it back; after `Delete for good` the meter is back to its earlier text | e2e/editor-media.spec.ts :: removing a file hides it and only deleting for good frees its space |
| C8 | a teammate sees it live; only the lead deletes (amendment 2026-11-20) | e2e | owner and member on one project, same node selected; member uploads `b.png`; then removes it | the owner's panel shows `b.png` without a reload and the same meter as the member, then loses it from the node and lists it as removed; the member's panel has no removed list and no `Delete` or `Restore` button | e2e/editor-media.spec.ts :: a teammate's upload and removal appear without a reload, and only the lead can delete |
| C9 | offline | e2e | `context.setOffline(true)` | `Add media` disabled; `Uploads need a connection. Try again when you are back online.` shown; back online: enabled | e2e/editor-media.spec.ts :: uploads wait for the connection |
| C10 | real files play | manual | a real WAV, MP3, MOV from a phone, MP4, JPEG and PNG, in Firefox and Chromium | each is accepted, plays or shows; a 150 MB video uploads (time noted) | |
### Probes
**Probe folder:** `tests/probes/2026-11-16-media-upload/task-4/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/media/mediaList.ts | `if (list.some((m) => m.id === event.record.id)) return list` | `if (false) return list` | frontend/src/features/editor/media/mediaList.test.ts |
### Flow
C10 above, then in Firefox and Chromium: attach several files to several nodes, switch nodes, trash a node with media (its files disappear from view; the meter does not go down), restore it with undo (the files are back), delete a file, upload over the limit after the admin lowers it in the dashboard. Record what you saw in `progress.md`.
### Evidence
The full output of `npm run check:task`, the failing run of the break, and the Flow record.
