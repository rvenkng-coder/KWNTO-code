# Task 3: Play on a share link

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** Task 2

**Files:**
- Create: `frontend/src/features/player/shareStory.ts`, `frontend/src/features/player/shareStory.test.ts`, `frontend/src/features/player/SharePlay.tsx`, `frontend/src/features/player/useShareMediaSrc.ts`, `e2e/player-share.spec.ts`
- Modify: `frontend/src/features/share/ShareMedia.tsx` (export the existing `useSource` hook; nothing else changes), `frontend/src/features/share/ReadOnlyViewer.tsx` (the `Play` button beside the project name), `e2e/helpers/player.ts` (any helper the share tests need)

**Interfaces:**
- Consumes: `Player`, `UseMediaSrc`, `MediaSrc` (`Player.tsx`); `Story`, `StoryMediaInput`, `buildStory` (`story.ts`); `contentFromFile` from `frontend/src/features/share/shareModel.ts`; `fromContent` from `frontend/src/features/editor/model/state.ts`; `ProjectFile` from `frontend/src/backend`; `MediaKind` from `frontend/src/backend/media-types.ts`; `backend.shares.mediaUrl(token, mediaId)` and `backend.shares.mediaBlob(token, mediaId)` through the existing `useSource(token: string, mediaId: string, signedIn: boolean): { src: string | null; gone: boolean; onError: () => void }` of `ShareMedia.tsx`.
- Produces in `shareStory.ts`: `storyOfFile(file: ProjectFile, projectId: string): Story`: `buildStory(fromContent(contentFromFile(file, projectId)), media)` where `media` holds the file's `media` entries whose `kind` is `audio`, `video` or `image` (others dropped), as `{ id, nodeId: m.node, title: m.title, kind }`.
- Produces in `useShareMediaSrc.ts`: `shareMediaSrc(token: string, needsSignIn: boolean): UseMediaSrc`: a hook that calls `useSource(token, media.id, needsSignIn)`. A view link loads media straight from the share route; a comment link fetches a blob with the person's token (the same rule as `ShareMedia`).
- Produces in `SharePlay.tsx`: `SharePlay({ file, projectId, token, needsSignIn }: { file: ProjectFile; projectId: string; token: string; needsSignIn: boolean })`: the `Play` button; at the click it builds the story with `storyOfFile` and keeps it in state; while it is set a `Player` shows, and `Close` clears it. The hook comes from `useMemo(() => shareMediaSrc(token, needsSignIn), [token, needsSignIn])`.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 3A: the tests

- [ ] **Step 1: Write failing tests**: `shareStory.test.ts` (C1) with a `ProjectFile` literal like the one in `shareModel.test.ts`; `e2e/player-share.spec.ts` (C2 to C7), seeding with `seedPlayStory` and the admin API as Task 2 does, making links with `makeLink` from `e2e/helpers/share.ts`, and opening them in a fresh browser context (`browser.newContext()`); the comment-link test signs in with `verifiedAccount` and `signInOnLinkScreen`; the live-refresh test installs `page.clock` before opening the link and runs it forward 35 s.
- [ ] **Step 2: Run, expect FAIL**: `npx vitest run frontend/src/features/player/shareStory.test.ts` and `npm run test:e2e -- e2e/player-share.spec.ts`.

## Checkpoint 3B: the viewer's Play button

- [ ] **Step 1: Implement `storyOfFile`.** Write this line exactly (a break targets it): `const KINDS: readonly string[] = ['audio', 'video', 'image']`.
- [ ] **Step 2: Export `useSource`** from `ShareMedia.tsx` (add `export`; no other change) and implement `shareMediaSrc` in `useShareMediaSrc.ts`.
- [ ] **Step 3: Implement `SharePlay` and place it** in `ReadOnlyViewer.tsx` in one row with the project name `<h2>` (the name on the left, the button on the right). `ReadOnlyViewer` passes `file`, `projectId`, `token` and `needsSignIn` through; it needs no other change, and the comment link's `CommentViewer` gets the button for free because it renders `ReadOnlyViewer`.
- [ ] **Step 4: Run, expect PASS**: `npx vitest run frontend/src/features/player`, `npm run test:e2e -- e2e/player-share.spec.ts e2e/share-links.spec.ts e2e/share-viewer-xss.spec.ts e2e/player.spec.ts`, `npm run typecheck`, `npm run lint`. Close the checkpoint (one commit) `feat: play the story from a share link`.

## Test plan

### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | a project file becomes a story | unit | a file with start `n1`, chapters `One` (position 1) and `Two` (position 2), nodes `n1` (`One`) and `n2` (`Two`), a line, a cue, connections `n1` to `n2` labelled `Go`, `n1` to nothing labelled `Wait`, and media `a` (image, node `n1`), `b` (audio, node `n2`), `c` (kind `document`, node `n1`) | `startId` is `n1`; `n1.choices` is `Go` (to `n2`) then `Wait` (no target); `n2.chapterTitle` is `Two`; no cues; `n1.media` ids `['a']` and `n2.media` ids `['b']` (`c` dropped) | frontend/src/features/player/shareStory.test.ts :: a project file becomes the story a player sees |
| C2 | a view link plays, signed out | e2e | the seeded project; a live view link; open it in a fresh context; click `Play`; click `Open the door` | the dialog `Player` shows `Gate` with its two choices and one `player-media` image whose `naturalWidth` is at least 1; then `Door`; `Close` returns to the viewer with its canvas; no sign-in was asked | e2e/player-share.spec.ts :: a view link plays the story without an account |
| C3 | HTML shows as text on a share link | e2e | as the admin set the title of `Gate`, a character and a line text, and the label of `Open the door` to HTML and script strings (as Task 2 C8); a view link; open it, click `Play` | the strings show as typed text; no `img[src="x"]`, no `b`, no `script` inside the dialog; `window.__xss` is undefined | e2e/player-share.spec.ts :: titles, lines and choices with HTML show as text on a share link |
| C4 | a snapshot link plays the frozen story | e2e | make a snapshot view link; as the admin rename `Gate` to `Gate 2`; open the link and play | the first screen reads `Gate`, not `Gate 2` | e2e/player-share.spec.ts :: a snapshot plays the story as it was published |
| C5 | a comment link plays, with its media | e2e | a comment link; a signed-in guest opens it and clicks `Play`, then `Open the door` | `Gate` shows its image; at `Door` an `audio` element whose `src` starts with `blob:` (the media was fetched with the person's token) and has `controls` | e2e/player-share.spec.ts :: a comment link plays with media loaded under the person's token |
| C6 | a trashed start node | e2e | as the admin move `Gate` to the trash (set `deleted_at`); a view link; click `Play` | the sentence `This project has no start node, so there is nothing to play yet.` and a `Close` button; no `player-title` | e2e/player-share.spec.ts :: a link to a project whose start node is trashed says there is nothing to play |
| C7 | a live refresh does not change the screen | e2e | a live view link, `page.clock` installed; open it, click `Play`; as the admin rename `Gate` to `Gate 2`; run the clock 35 s; then `Close` and `Play` again | while open the screen still reads `Gate`; after reopening it reads `Gate 2` | e2e/player-share.spec.ts :: a live view refresh waits for the player to be reopened |

### Probes
**Probe folder:** `tests/probes/2026-11-26-player-mode/task-3/`

### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/player/shareStory.ts | `const KINDS: readonly string[] = ['audio', 'video', 'image']` | `const KINDS: readonly string[] = ['audio', 'video']` | frontend/src/features/player/shareStory.test.ts |

### Flow
none

### Evidence
The full output of `npm run check:task`, of the e2e run, and the failing run of the break.
