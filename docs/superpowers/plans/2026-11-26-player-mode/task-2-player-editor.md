# Task 2: The Player and the editor's Play button

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** Task 1

**Files:**
- Create: `frontend/src/features/player/Player.tsx`, `PlayerScreen.tsx`, `PlayerMedia.tsx`, `PlayerHistory.tsx`, `usePlayer.ts`, `EditorPlay.tsx`, `useEditorMediaSrc.ts` (all in `frontend/src/features/player/`), `e2e/player.spec.ts`, `e2e/helpers/player.ts`
- Modify: `frontend/src/index.css` (the `.player-step` keyframes), `frontend/src/features/editor/EditorHeader.tsx` (the `Play` button, before the `MemberOnly` block)

**Interfaces:**
- Consumes: `Story`, `PlayNode`, `PlayMedia`, `StoryMediaInput`, `buildStory` (`story.ts`); `Session`, `Screen`, `HistoryEntry`, `startSession`, `choose`, `back`, `screenOf`, `historyOf` (`session.ts`); `useModalKeys`, `useFocusGuard` from `frontend/src/features/editor/export/useModalKeys.ts`; `MEDIA_GONE` from `frontend/src/features/share/ShareMedia.tsx`; `useEditor`, `editorStore` from `frontend/src/features/editor/store/editorStore.ts`; `useMediaStore` from `frontend/src/features/editor/media/useProjectMedia.ts` (`media: Media[]`, `fileToken: string | null`); `backend.media.fileUrl(media: Media, token: string): string`.
- Produces in `Player.tsx`:
  - `interface MediaSrc { src: string | null; gone: boolean; onError(): void }` and `type UseMediaSrc = (media: PlayMedia) => MediaSrc` (a hook; the host passes one function for the player's whole life)
  - `Player({ story, useMediaSrc, onClose }: { story: Story; useMediaSrc: UseMediaSrc; onClose(): void })`: a portal on `document.body`, `role="dialog"`, `aria-modal="true"`, `aria-label="Player"`; the buttons `Back`, `Restart`, `History` (`aria-expanded`), `Close`
- Produces in `usePlayer.ts`: `type Transition = 'fade' | 'slide-forward' | 'slide-back'` and `usePlayer(story: Story): { screen: Screen | null; history: HistoryEntry[]; transition: Transition; moves: number; note: string | null; choose(choiceId: string): void; back(): void; restart(): void }`. It keeps the `story` it was first given and never reads a later one (D3). `screen` is `null` when there is nothing to play. `moves` counts every successful move, back or restart (it keys the animation). `note` is the empty-choice sentence after a refused choice, and `null` after any move.
- Test ids drawn by the player: `player-step` (the node's region, `tabIndex={-1}`, `aria-live="polite"`, `data-transition`), `player-chapter`, `player-title`, `player-line`, `player-media`, `player-choice`, `player-end`, `player-note`, `player-history`.
- Produces in `EditorPlay.tsx`: `EditorPlay()` (no props): the `Play` button, and while open a `Player` whose story was built at the click from `editorStore.getState().content` and the media in `useMediaStore.getState().media` that are not removed (`removedAt === ''`), as `StoryMediaInput`. Focus returns to the button on close.
- Produces in `useEditorMediaSrc.ts`: `useEditorMediaSrc: UseMediaSrc`. It looks the file up in `useMediaStore` and builds the URL with `backend.media.fileUrl` once, from the first non-null `fileToken` it sees, and keeps that URL for the life of the component (D8).

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 2A: the end-to-end tests

- [ ] **Step 1: Write failing tests** `e2e/player.spec.ts` (C1 to C12), with the setup of `e2e/share-viewer-xss.spec.ts` (`ownerWithProject`, the admin API). Put the seed in `e2e/helpers/player.ts`: `seedPlayStory(projectId: string): Promise<{ gate: string; door: string; garden: string }>`, written as the admin like `seedStory` in `e2e/helpers/share.ts`:
  - a second chapter `The Garden` (position 2) next to the first (`Chapter 1`)
  - nodes `Gate` (the first created, so the start; chapter 1), `Door` (chapter 1), `Garden` (chapter 2)
  - `Gate`: lines `{ Mara, Who goes there? }`, `{ '', Rain falls. }` and a blank `{ '', '' }`; a cue of type `lighting`, text `Dim the lights`; an image (`PNG_1PX`, as `seedStory`); choices in order `Open the door` to `Door` and `Wait` with no target
  - `Door`: a WAV (`sampleBytes('wav', 2048)`); choices in order `Go back` to `Gate` and one with an empty label to `Garden`
  - `Garden`: nothing else
  - plus `changeRecord(collection: string, id: string, fields: Record<string, string>): Promise<void>` (reads the record's `version` and updates with it, as the helper inside `share-viewer-xss.spec.ts` does) and `openPlayer(page): Promise<Locator>` (clicks `Play` and returns the `Player` dialog).
- [ ] **Step 2: Run, expect FAIL**: `npm run test:e2e -- e2e/player.spec.ts`.

## Checkpoint 2B: the player and the button

- [ ] **Step 1: Implement `usePlayer`**: `useState(() => story)` for the frozen story; the session in state, started with `startSession`; `choose` calls the pure `choose` and sets `transition: 'slide-forward'`, or sets `note` to `This choice isn't linked to a node yet.` and changes nothing else when it returns `null`; `back` sets `'slide-back'`; `restart` calls `startSession` again and sets `'fade'`; the first transition is `'fade'`.
- [ ] **Step 2: Implement the pieces.** `PlayerScreen`: draws, inside `<div key={moves} data-testid="player-step" className="player-step" data-transition={transition}>`, in order: the chapter title (`player-chapter`) when `screen.showChapter`; the node title (`player-title`, a heading); the lines (`player-line`: for a line with a character, the name in a `span` of class `player-character` before the text; a line without one is action and has class `player-action`); the media (`PlayerMedia`); the choices (`player-choice`, one `button` each with the label); `The End` (`player-end`) when `screen.isEnd`; the note (`player-note`, `role="status"`) when set. After every change of `moves` after the first it moves focus to `player-step`. `PlayerMedia({ media, useMediaSrc })`: an `img` (no `alt` beyond the media title, class `max-h-[50vh] object-contain`), or an `audio` or `video` with `controls` and `autoPlay`, each `data-testid="player-media"`; `MEDIA_GONE` text in muted style when `gone` is true or `onError` fired. `PlayerHistory({ entries })`: an ordered list, `data-testid="player-history"`, the current entry has `aria-current="step"`, under the heading `History`. `Player`: wires them with `useModalKeys(box, false, onClose)` and `useFocusGuard(box)`, a full-window flat panel over a backdrop (`fixed inset-0 z-50`), the project name in its top bar, `Back` disabled when `!screen?.canGoBack`, and when `screen` is `null` the nothing-to-play sentence with `Close`.
- [ ] **Step 3: CSS** in `index.css`: keyframes `player-slide-forward` (from `opacity: 0; transform: translateX(2rem)`), `player-slide-back` (from `opacity: 0; transform: translateX(-2rem)`), `player-fade` (from `opacity: 0`), each to `opacity: 1; transform: none`; `.player-step[data-transition='slide-forward']`, `'slide-back'` and `'fade'` use them for `250ms ease-out`; inside `@media (prefers-reduced-motion: reduce)` the rule `.player-step { animation: none; }`. Screenplay look: `.player-character` uppercase (`text-transform: uppercase`), muted, small; `.player-action` italic.
- [ ] **Step 4: Implement `useEditorMediaSrc` and `EditorPlay`, and place the button** in `EditorHeader.tsx` before `<MemberOnly>`.
- [ ] **Step 5: Run, expect PASS**: `npm run test:e2e -- e2e/player.spec.ts e2e/shell.spec.ts e2e/editor-export.spec.ts`, `npm run test:unit`, `npm run typecheck`, `npm run lint`. Close the checkpoint (one commit) `feat: play the story from the editor`.

## Test plan

### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | the Play button opens and closes the player | e2e | the seeded project, reload; click `Play` in the title bar; press Escape | a dialog named `Player` shows; after Escape it is gone and focus is back on `Play`; `Close` does the same | e2e/player.spec.ts :: Play opens the player and Escape closes it |
| C2 | play starts at the start node | e2e | open the player | chapter text `Chapter 1`, title `Gate`, two `player-choice` buttons `Open the door` and `Wait`, one `player-media` image, `Back` disabled | e2e/player.spec.ts :: the player starts at the start node |
| C3 | screenplay lines, no cues, no blank lines | e2e | open the player | two `player-line` entries: `Mara` then `Who goes there?` and `Rain falls.` without a character name; the text `Dim the lights` and `lighting` appear nowhere in the dialog | e2e/player.spec.ts :: lines are screenplay style and cues stay out |
| C4 | an empty choice does not move | e2e | click `Wait` | `player-note` reads `This choice isn't linked to a node yet.`; the title is still `Gate` and both choices are still there; clicking `Open the door` clears the note | e2e/player.spec.ts :: an empty choice shows a note and stays |
| C5 | choices move, the chapter banner and the end | e2e | click `Open the door`, then the choice whose label is empty | `Door` with no `player-chapter`; then `Garden` with `player-chapter` text `The Garden`, no choices and `The End` shown | e2e/player.spec.ts :: choices lead on, the chapter name shows when it changes and the path ends |
| C6 | nothing to play | e2e | a new project with no node; click `Play` | the sentence `This project has no start node, so there is nothing to play yet.` and a `Close` button; no `player-title` | e2e/player.spec.ts :: a project with no start node says so |
| C7 | back, restart and history | e2e | `Gate` to `Door` to `Garden`; open `History`; click `Back`; click `Restart` | the history items read `Gate`, `Open the door → Door`, `Garden → Garden`, the last `aria-current`; after `Back` the title is `Door` and the history has two items; after `Restart` the title is `Gate` and the history has one item | e2e/player.spec.ts :: back, restart and the history follow the path |
| C8 | HTML in the story shows as text | e2e | as the admin set the title of `Gate` to `<img src=x onerror="window.__xss=1">`, its character and a line text to `<script>window.__xss=1</script><b>bold</b>`, and the label of `Open the door` to the same script text; open the player | the strings show as typed text in the title, the line and the choice; no `img[src="x"]`, no `b` and no `script` inside the dialog; `window.__xss` is undefined | e2e/player.spec.ts :: titles, lines and choices with HTML show as text |
| C9 | the transitions | e2e | open; click `Open the door`; `Back`; `Restart` | `data-transition` of `player-step` is `fade`, `slide-forward`, `slide-back`, `fade`; with `emulateMedia({ reducedMotion: 'reduce' })` the computed `animation-name` of `player-step` is `none` | e2e/player.spec.ts :: transitions are named and switch off for reduced motion |
| C10 | the story is frozen and playing writes nothing | e2e | record every non-GET request to `/api/` from here; open the player; as the admin rename `Gate` to `Gate 2`; click `Open the door` and `Go back`; close and open again | the screen still reads `Gate` while open and after going back; after reopening it reads `Gate 2`; no non-GET request was sent; the canvas still shows 3 nodes | e2e/player.spec.ts :: the player keeps its story and writes nothing |
| C11 | media plays with its node and stops when it ends | e2e | click `Open the door`, then the empty-label choice | at `Door` one `audio` with `controls` and `autoplay`; at `Garden` no `audio` in the page | e2e/player.spec.ts :: audio comes with its node and goes when the node does |
| C12 | keys stay in the dialog | e2e | select the node `Door` on the canvas; open the player; press `Delete`, `x` and Tab several times; close | `Door` is still on the canvas (3 nodes); focus never leaves the dialog | e2e/player.spec.ts :: keys in the player do not reach the editor |

### Probes
**Probe folder:** `none`

### Breaks
none

### Flow
none (the transitions are judged by eye in manual item M3, which Task 4 records)

### Evidence
The full output of `npm run check:task` and of the e2e run.
