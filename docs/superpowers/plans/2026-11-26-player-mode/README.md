# Player Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an author playtest the story from its start node, and let anyone with a view or comment share link play it, one node at a time with slide and fade transitions, media, screenplay-style lines, restart, back and a path history.

**Architecture:** Nothing changes on the server. A pure `Story` (only what a player sees: live nodes, their lines, media and choices) is built from a `ContentState`, so the editor's store and a share link's project file feed the same code (`contentFromFile` already turns a file into a `ContentState`). A pure `Session` (the list of nodes visited and the choice taken to each) does start, choose, back and restart. One `Player` overlay draws the current node and takes a media hook from its host, because the editor, a view link and a comment link each load media differently. Two entry points open it: a `Play` button in the editor's title bar and a `Play` button in the read-only share viewer.

**Tech Stack:** React 19, Zustand 5, TypeScript, Vitest, Playwright, plain CSS keyframes. **No new dependencies.**

**Spec:** [Design section 6.4](../../specs/2026-11-11-kwnto-design.md) (Player Mode), section 5 (view links work without an account, comment and edit links need sign-in), section 9b (a connection's label, else the target node's title) and the [editor cards design](../../specs/2026-11-18-editor-cards-design.md) (an empty choice is a dead end in Player Mode). Also binding: [engineering.md](../../../engineering.md), [security.md](../../../security.md), [testing-strategy.md](../../../testing-strategy.md). Executors read all of them.

**Standard:** test-plan-v1

## Global Constraints

- **Worktree and branch:** `feat/player-mode` (this worktree), created from `main` (a774cc4). Progress is tracked in `.planning/2026-11-26-player-mode/progress.md`.
- **Every task ends with:**

  ```
  npm run check:task -- --task docs/superpowers/plans/2026-11-26-player-mode/task-<n>-<name>.md --base <sha at task start> --built-by <local|strong>
  ```

  Paste the full output in the report. Tasks of tier `mid` use `--built-by strong`.
- **Hard rules (AGENTS.md):** only `frontend/src/backend/` imports `pocketbase` (the player needs no new backend call); 300 lines max per file; no `any`; no dependencies; never edit a failing test; never merge.
- **What a player sees (design 6.4):** the node's title, its script lines in screenplay style (character name, then the spoken text; a line with no character is action or narration), its images, audio and video, and its choices as buttons. **Never** cues, lighting notes, comments, node links or presence. A chapter's name shows at the start and whenever it changes.
- **Copy, exactly:**
  - entry button `Play` (editor title bar and read-only viewer); dialog label `Player`
  - buttons `Back`, `Restart`, `History`, `Close`; end of a path `The End`
  - an empty choice, when clicked: `This choice isn't linked to a node yet.` (in a `role="status"` element; the player stays where it is)
  - nothing to play: `This project has no start node, so there is nothing to play yet.` (with a `Close` button)
  - a media file that fails to load: `Media removed` (the string `MEDIA_GONE` of `features/share/ShareMedia.tsx`)
  - history heading `History`; the first entry reads `<node title>`, each later one `<choice label> → <node title>`
  - a node with no title reads `Untitled`; a choice with no text and a target with no title reads `Untitled`
- **Choice label rule (design 9b):** the connection's label, trimmed; if empty, the target node's title, trimmed; if empty, `Untitled`.
- **Text is text:** every title, line, character and label is drawn as React text. No `dangerouslySetInnerHTML` (ESLint bans it; security.md section 5).
- **Styling:** theme tokens only, flat solid panels (design 6.6: no translucent or blurred panels). The player follows the account theme (a signed-out viewer follows the browser's).

## Decisions

| # | Decision |
|---|---|
| D1 | **No new dependency, and one small server change (decided with the developer, 2026-11-26, Task 3).** The share link's project file listed choices in id order, so a view link offered them in a different order than the editor; the file builder now sorts `connections` by `created`, then id. Otherwise nothing changes on the server. The player reads what the editor store and the share viewer already hold. Player Mode writes nothing: no edit, no undo step, no request other than the media file loads. Path analytics (recording choices) is Plan 10 and adds its hook then; this plan leaves no unused seam for it. |
| D2 | **One model for both sources.** `buildStory(state, media)` takes a `ContentState` and a plain list of media entries. The editor passes `fromContent`-style state from `editorStore` and its live media; the viewer passes `fromContent(contentFromFile(file, projectId))` and `file.media`. Removed media never reaches the editor's list (`mediaOf` hides it) and a project file leaves it out (project-file.md). |
| D3 | **The story is frozen when the player opens.** The `Player` keeps the `Story` it was opened with. A teammate's edit arriving over the live connection, or a live share view re-reading every 30 s, never changes a screen under a reader or breaks a saved path. To see new edits, close and open the player. Documented in the user guide. |
| D4 | **Start:** the project's start node, if it is live (`effectiveStart`). No start node (an empty project, or the start node is in the trash) shows the nothing-to-play message; the player never guesses another node. |
| D5 | **Choices:** the node's choices in editor order (`choicesOf`: by `created`, then id), so a choice to a trashed node is not shown. A choice with a target is a button that moves. A choice with no target (empty choice) is also a button, so the playtester sees what was written; clicking it shows the empty-choice note and does not move (the prototype's "Dead end detected"). **The End** shows when no choice has a target (no choices, or all empty), which is the editor's End marker. A choice to the node itself is allowed and moves to a new step of the same node. |
| D6 | **Path and history:** a session is the list of steps `{ nodeId, viaChoiceId }`, step 0 being the start. `Back` removes the last step (disabled on step 0). `Restart` goes back to step 0 and forgets the rest. `History` is a read-only list of the steps (no jumping). A loop (A to B to A) just adds steps; nothing recurses. |
| D7 | **Entry and exit:** a modal dialog on `document.body` over the whole window (`role="dialog"`, `aria-modal="true"`, label `Player`), opened from the `Play` button and closed by `Close` or Escape; focus returns to `Play`. No new route: a player is not linkable (a share link already is). Edit-link visitors land in the editor and use its `Play`. |
| D8 | **Media:** images are drawn in place; audio and video get native `controls` and `autoPlay` (a click on `Play` or on a choice is the user gesture browsers require; if one still blocks it the controls are there). Leaving a node removes its media, which stops it. Each host supplies a `useMediaSrc` hook: the editor builds the file URL once per node visit from the media store's file token (a refresh of the token every 45 s must not restart a playing file); a view link uses `backend.shares.mediaUrl`; a comment link fetches a blob as `ShareMedia` does. A failed load shows `Media removed`. |
| D9 | **Transitions:** CSS keyframes only. Choosing a choice slides the new node in from the right (`slide-forward`), `Back` from the left (`slide-back`), the first screen and `Restart` fade in (`fade`). The page element carries `data-transition` with that name. Under `prefers-reduced-motion: reduce` there is no animation. Whether it looks right is manual item M3. |
| D10 | **Focus and keys:** the dialog traps Tab and stops every key from reaching the editor's shortcuts behind it (the export dialog's `useModalKeys`). After every move the node's region takes focus and is `aria-live="polite"`, so a screen reader hears the new node. |

## Tasks

| Task | What | Tier | Status |
|---|---|---|---|
| [1](task-1-story-session.md) | The pure `Story` and `Session` | local | done |
| [2](task-2-player-editor.md) | The `Player`, its transitions and the editor's `Play` button | mid | done |
| [3](task-3-player-share.md) | `Play` in the read-only viewer (view and comment links) | mid | done |
| [4](task-4-docs-closeout.md) | Docs, test plan, roadmap, manual item M3, closeout | mid | done |

## Review Focus

Likely to bite a person, most likely first. Each line has a test in the owning task.

1. **A project with no start node, or no nodes**: `Play` opens an empty or broken screen. It shows the D4 message and a `Close` button (Task 1 C3, Task 2 C6).
2. **An empty choice** (written, never linked): it must not move, crash or disappear; it shows the note (Task 1 C4, Task 2 C4).
3. **A blank script line** (an added line with no character and no text) leaves a gap on screen, and **cues leak into the player**. Blank lines are dropped and cues never appear (Task 1 C2, Task 2 C3).
4. **A loop** (A to B to A, or a choice to the same node) hangs, repeats a chapter banner wrongly or overflows the history. Each move is one new step; back undoes exactly one (Task 1 C6, C7).
5. **Text with HTML or a script** in a title, line, character or choice, in the editor and on a share link's page, runs or becomes an element. It shows as typed text (Task 2 C8, Task 3 C3).

## Files

| Path | Role |
|---|---|
| `frontend/src/features/player/story.ts` | `Story`, `PlayNode`, `buildStory` (pure) |
| `frontend/src/features/player/session.ts` | `Session`, `startSession`, `choose`, `back`, `screenOf`, `historyOf` (pure) |
| `frontend/src/features/player/Player.tsx`, `PlayerScreen.tsx`, `PlayerMedia.tsx`, `PlayerHistory.tsx`, `usePlayer.ts` | The overlay, the node's screen, its media, the history list and the state hook |
| `frontend/src/features/player/EditorPlay.tsx`, `useEditorMediaSrc.ts` | The editor's `Play` button, the story from the store, the editor's media hook |
| `backend/pb_hooks/lib/project-file-build.js`, `project-records.js` | Connections listed in creation order (Task 3) |
| `frontend/src/features/player/SharePlay.tsx`, `useShareMediaSrc.ts`, `frontend/src/features/share/useShareSource.ts` | The viewer's `Play` button and the media hooks of view and comment links |
| `frontend/src/index.css` | The `.player-step` keyframes and the reduced-motion rule |
| `frontend/src/features/editor/EditorHeader.tsx`, `frontend/src/features/share/ReadOnlyViewer.tsx` | Where the two `Play` buttons are placed |
| `e2e/player.spec.ts`, `e2e/player-share.spec.ts`, `e2e/helpers/player.ts` | The end-to-end tests and the story they seed |
