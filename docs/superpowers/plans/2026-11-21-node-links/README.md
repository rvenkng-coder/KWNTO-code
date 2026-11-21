# Node Links and Video Uploads Off Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop accepting video files (`mp4`, `mov`) and give each node a "Links and other material" section (title and web address) so writers can link a video instead of uploading it.

**Architecture:** Videos off is a data change (the admin setting `system_storage.allowed_types`) plus one front-end fix: the file picker's `accept` list is hard-coded today and must follow the setting. Links are a new PocketBase collection `node_links` with the same access rules as `media`, a server hook that accepts only `http://` and `https://` addresses, a new door in `frontend/src/backend/`, and a section in the node panel.

**Tech Stack:** PocketBase 0.40 (JS migrations and hooks), React 19, Zustand 5, TypeScript, Vitest, Playwright. No new dependencies.

**Spec:** [Node links design](../../specs/2026-11-21-node-links-design.md). Also binding: [engineering.md](../../../engineering.md), [security.md](../../../security.md), [testing-strategy.md](../../../testing-strategy.md). Executors read all of them.

**Standard:** test-plan-v1

## Global Constraints

- **Worktree and branch:** `feat/node-links` in the sibling folder `../KWNTO-code-links`, created from `main` (do not build on `feat/deployment`, which is an open pull request). Progress is tracked in `.planning/2026-11-21-node-links/progress.md`.
- **Every task ends with:**

  ```
  npm run check:task -- --task docs/superpowers/plans/2026-11-21-node-links/task-<n>-<name>.md --base <sha at task start> --built-by strong
  ```

  Paste the full output in the report.
- **Migration numbers:** `1794400000_video_off.js` and `1794400100_node_links.js`. They are higher than the deployment branch's `1794390200`, so the two branches can merge in either order.
- **Hard rules (AGENTS.md):** only `frontend/src/backend/` imports `pocketbase`; 300 lines max per file; no `any`; deny-by-default rules; no new dependencies; never edit a failing test (see D3 for the three developer-approved changes); never merge.
- **Web addresses (the safety rule):** a link address is accepted only when it matches, case-insensitively, `^(https?):\/\/([^\s\/?#@\\]+)([\/?#]\S*)?$`, is at most 2000 characters after trimming, and is not empty. The server and the client use the same rule and the same messages (D4). Nothing else (`javascript:`, `data:`, `ftp:`, `file:`, `//host`, addresses with spaces or a user name and password) may ever be stored or rendered as a clickable link.
- **Copy, exactly:**
  - section heading `Links and other material`
  - inputs labelled `Link title` and `Link address`, button `Add link`, per-item button `Delete link`
  - messages: `Enter a web address.`, `That is not a web address.`, `Only http:// and https:// addresses are allowed.`, `The address is longer than 2000 characters.`
  - video message (from the existing check, with the new list): `This file type is not allowed. Allowed: WAV, MP3, JPEG, PNG.`
- **Styling:** theme tokens only; same look as the media section.

## Decisions

| # | Decision |
|---|---|
| D1 | Videos off by a new migration `1794400000_video_off.js` that removes `mov` and `mp4` from the existing `system_storage.allowed_types`; the old migration is not edited. A fresh install runs both, so it also starts with video off. The admin can switch it back on in the dashboard. Both video types, because the reason (slow large uploads) covers both. |
| D2 | The file picker's `accept` is computed from `storage.allowedTypes` by a pure `acceptFor`. Before the storage info loads it is empty (no filter); the early check and the server still refuse. |
| D3 | Three existing tests assert the old default and change **because the developer decided video is off**: `tests/rules/system_storage.rules.test.ts` (expected list), `tests/rules/media.rules.test.ts` (the storage route's `allowedTypes`), `e2e/editor-media.spec.ts` (`audio and video files get players`). Task 1 lists the exact new assertions. Any other failing test, including a sealed probe, means stop and report. |
| D4 | The address rule is written twice (hook `backend/pb_hooks/lib/link-check.js`, client `frontend/src/features/editor/links/linkCheck.ts`) because PocketBase's JS runtime has no `URL` class and the client must not call the server just to validate. A rules test proves they agree on a table of addresses. |
| D5 | `node_links` rules: members of the project's team with a verified account list, view and create; nobody updates; any member deletes; no quota. Removing is a plain delete, not hide-and-restore. |
| D6 | No limit on the number of links per node (the rate limiter applies). Accepted for now; see Review Focus. |

## Tasks

| Task | What | Status |
|---|---|---|
| [1](task-1-video-off.md) | Videos off: migration, `acceptFor`, test and doc updates | not started |
| [2](task-2-links-backend.md) | `node_links` collection, address check, hook, rules tests | not started |
| [3](task-3-links-door.md) | The door, client address check, door tests | not started |
| [4](task-4-links-ui-closeout.md) | Section in the node panel, store, e2e, docs, closeout | not started |

## Review Focus

Likely to bite a person, most likely first. Each line has a test in the owning task.

1. A `javascript:` address (any capitalisation, or with a leading space or newline) becomes a clickable link. Must be refused by the server and the client (Task 2 C5, Task 3, Task 4 e2e).
2. An address with a user name in front (`https://google.com@evil.example`) hides the real host. Must be refused (Task 2 C5).
3. A very long title or address, or a title with markup (`<script>`), breaks the layout or runs. The title is shown as text; the address is capped at 2000 (Task 2 C5, Task 4 e2e).
4. The same link appears twice after a fast double-click or a live event arriving with the response. The list must not show duplicates (Task 4 C2).
5. A teammate in another team, or someone signed out, reads or adds links (Task 2 C2, C3).
6. Video is still uploadable through a route the picker does not cover (Task 1 C5).

## Files

| Path | Role |
|---|---|
| `backend/pb_migrations/1794400000_video_off.js` | Removes `mov` and `mp4` from `allowed_types` |
| `backend/pb_migrations/1794400100_node_links.js` | The `node_links` collection |
| `backend/pb_hooks/lib/link-check.js`, `backend/pb_hooks/links.pb.js` | The address rule and the create hook |
| `frontend/src/backend/links.ts`, `link-types.ts` | The links door |
| `frontend/src/features/editor/links/` | `linkCheck.ts`, `linksList.ts`, `useProjectLinks.ts`, `LinksSection.tsx`, `LinkItem.tsx` |
| `frontend/src/features/editor/media/uploadCheck.ts`, `MediaSection.tsx`, `useOnline.ts` | `acceptFor`; `useOnline` moves out of `MediaSection.tsx` |
