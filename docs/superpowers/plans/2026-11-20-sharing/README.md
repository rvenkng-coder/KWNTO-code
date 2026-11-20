# Trash, Share Links, Comments, Presence and Project Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The second build step of design section 11. Trashed projects, chapters and nodes can be seen and restored for 30 days and are then purged. A project can be exported to and imported from a JSON file. Team members share a project by link (view, comment or edit; live or snapshot; revocable). Anyone with a view link can look without an account, including media. People comment on nodes, and see who else is editing a node.

**Architecture:** Every new rule is deny-by-default and pinned by rule tests for member, outsider, signed-out, link holder and revoked link. The project file is built and checked **only on the server** (`backend/pb_hooks/lib/project-file.js`): export, import, snapshots and the view of a shared project all use the same builder and the same validator, so there is one format and one place that trusts nothing. Link holders reach content in two ways. View and comment links read through routes under `/api/kwnto/share/{token}`, which check the token on every request; the browser shows a read-only viewer built from the project file. Edit links make a `link_grants` row for the signed-in person, and the content collections' rules accept that grant next to team membership, so the normal editor, live events and the offline queue work unchanged. Comments and presence are ordinary collections with live subscriptions through the door.

**Tech Stack:** PocketBase 0.40.6 (JS hooks, routes, cron, migrations, rules with `@collection` joins), `pocketbase` JS SDK 0.28, React 19, TypeScript, Zustand 5, `@xyflow/react` 12, Vitest, Playwright. No new dependencies (D3: no `zod`).

**Spec:** [Design](../../specs/2026-11-11-kwnto-design.md) sections 5 (share links, comments, concurrent edits and presence), 6.8 (trash and recovery), 6.9 (share links carry who made them), 7c (`trash_retention_days`, `presence_timeout_seconds`; incident control "revoke all share links"), 8b (rule tests for links, e2e for a link opened without an account and for JSON import then export, unit tests for import validation), 9b (snapshots reference media), 9c (`comments`, `share_links`, `presence`), 10 (project import and export as JSON), 11 step 2; the [ERD](../../specs/2026-11-11-kwnto-erd.md); [security.md](../../../security.md) sections 2 (access control, links), 3 (verified for sign-in links), 5 (XSS, bad imports), 7 (trash), 9 control 6; the [roadmap](../README.md) outline "7." and its carried-over items from Plans 3 and 4. Also binding: [engineering.md](../../../engineering.md), [testing-strategy.md](../../../testing-strategy.md), [backend.md](../../../developer/backend.md), [editor.md](../../../developer/editor.md). Executors read all of them, and the [editor core plan](../2026-11-14-editor-core/README.md) and [offline sync plan](../2026-11-16-offline-sync/README.md) routers.

**Standard:** test-plan-v1

## Global Constraints

Everything in the [Plan 1 router](../2026-11-11-foundation/README.md) "Global Constraints" still applies (zero cost, no new dependency, ask first, worktree, 300-line files, no `any`, deny by default, tests documented, prototype is reference only, secrets never in git, docs are part of done, Node 22, ports). Values this plan depends on:

- **Worktree and branch:** `feat/sharing` in the sibling folder `../KWNTO-code-sharing`, created from `main` at 9416ede. Plan 6 is built in parallel on `feat/deployment`; neither needs the other's code. Merge `main` before a task if it has moved; never rebase this branch once pushed. Tracking in `.planning/2026-11-20-sharing/progress.md`.
- **Every task ends with** `npm run check:task -- --task docs/superpowers/plans/2026-11-20-sharing/task-<n>-<name>.md --base <sha at task start> --built-by <local|strong>`, full output pasted in the report.
- **Probes are written by the controller, not the implementer**, before a task is dispatched.
- **Migrations:** new files from `1794400000_*` upward (Plan 6 uses `17943900xx`). Every new collection gets `tests/rules/<name>.rules.test.ts` (the coverage check fails otherwise). **No rule is public (`""`)**: anonymous view links go through routes, never through a public rule.
- **Every rule test file of this plan covers, for each action:** member, owner, outsider, signed-out, unverified (where verification is required), a holder of a view, comment and edit link, a revoked link, and an injection string (`' OR 1=1 --`, `%`) in any id or token. After writing a rule, open it once (`@request.auth.id != ''`), watch a test fail, restore it, and say so in the report.
- **Tokens:** 40 characters from `A-Za-z0-9` (`$security.randomStringWithAlphabet`), about 238 bits, made only by the server. A token is looked up as a bound parameter, never pasted into a filter.
- **No oracle:** an unknown token, a revoked link and a link whose project is in the trash all get the same 404 with the same body.
- **Settings are read at run time** (design 7c): `system_behavior.trash_retention_days` (30) and `presence_timeout_seconds` (30).
- **Exact copy** (tests compare it):
  - Bad link: `This link is not valid or was revoked.`
  - Sign-in link while signed out: `Sign in to open this shared project.`
  - Unverified holder of a sign-in link: `Verify your email to open this shared project.`
  - Import too large: `This file is larger than the 5 MB import limit.`
  - Import not valid: `This file is not a KWNTO project: <first problem>` (problems are produced by `validateProjectFile`)
  - Trash: `<n> days left` (`1 day left` for 1), `Removed tonight` for 0
  - Restore a node of a trashed chapter: `Restore the chapter <title> first.`
  - Revoke question (drawn in the row, never `confirm()`): `Revoke this link? Anyone using it loses access at once.`
  - Comment delete question (in the row): `Delete this comment?`
  - Presence: `<name> is editing`
  - Snapshot media gone: `Media removed`

## Review Focus

The failure modes the spec implies that are most likely to bite a person, each pinned by a test in the task named:

1. **A revoked link stops working at once, everywhere:** the view route, its media route, comments by a comment-link holder, and an edit-link holder's open editor (their next save is refused and their live events stop). (Task 3 C6, Task 5 C3, Task 4 C5)
2. **A client clock cannot purge a teammate's work.** `deleted_at` is set by the browser today (Plan 3 D14); a browser with a wrong clock, or a hand-made request, could send a date 31 days ago and lose the node at tonight's purge. The server must stamp its own time. (Task 1 C2)
3. **An import file is untrusted:** too large, wrong shape, a connection or start node pointing at an id not in the file, 10,000 nodes, text over the field limits, a `__proto__` key, ids that collide with records already in the database. Each is refused with a message and leaves nothing half-imported. (Task 2 C2 to C4)
4. **An edit link grants one project, never the team:** the holder cannot see the team, its other projects, its members, its join code, or delete or trash the project. (Task 3 C8)
5. **A comment is shown as text**, never as HTML, in the panel, on the share viewer and in the count badge (security.md 5 XSS). (Task 5 C6)

Also covered, lower risk: a snapshot shows `Media removed` once its file is deleted for good (Task 4 C4); presence rows of a person who closed the tab disappear after the timeout (Task 6 C2); the purge runs in batches and removes media files with their nodes (Task 1 C4).

## Decisions made in this plan (please review)

The roadmap's "Decide first" items and calls where the spec is silent. Each is cheap to change before the task that builds it.

| # | Decision | Task |
|---|---|---|
| D1 | **One plan, cut from the bottom.** The roadmap allowed splitting Plan 7 in two. It stays one plan, ordered by value: trash, project files, share links, comments, presence, then the Plan 3 and 4 carry-overs. If time runs out, Tasks 6 and 7 move to a later plan. | all |
| D2 | **How a link token is checked inside access rules:** it is not. View and comment links never touch collection rules; routes under `/api/kwnto/share/{token}` look the token up and read with the app's privileges. Edit links (signed-in, verified) create a `link_grants` row (`link`, `user`, `project`, `permission`), and the content rules gain `|| <edit grant>` next to the membership check. Grants are why the edit-link holder's live events and offline queue need no new code. A revoked link keeps its grants but they stop counting (`link.revoked = false` is part of the check). | 3 |
| D3 | **No `zod`.** The import validator is hand-written in `lib/project-file.js` (CommonJS, unit-tested), because it must run inside PocketBase (the server is the only judge, D4), where an npm package cannot be loaded. No decision record is needed since nothing is added. | 2 |
| D4 | **The project file lives on the server.** `GET /api/kwnto/projects/{id}/export` builds it; `POST /api/kwnto/teams/{id}/import` validates it and creates the whole project **in one transaction** (all or nothing); snapshots store its output; the share route serves it. The browser only downloads and uploads it. Format below. | 2 |
| D5 | **The file format** (version 1): `{ format: "kwnto-project", version: 1, exportedAt, project: { name, startNode }, chapters: [{ id, title, position }], nodes: [{ id, chapter, title, color, x, y }], lines: [{ id, node, character, text, sortOrder }], cues: [{ id, node, type, text, sortOrder }], connections: [{ id, from, to, label }], media: [{ id, node, title, kind }] }`. Trashed records and removed media are left out. Ids are the original ones; import gives every record a new id and maps every reference. `media` is metadata only (files are not in the file); import ignores it. Limits: 5 MB (5,242,880 bytes), 200 chapters, 2,000 nodes, 20,000 lines, 10,000 cues, 10,000 connections, the same text lengths as the collections' fields. | 2 |
| D6 | **Import reuses `Chapter 1`.** The project create hook always makes `Chapter 1`; the import renames and re-positions it as the file's first chapter instead of deleting it. The file's start node is set after the nodes exist (the first-node hook sets one first; the import overwrites it). | 2 |
| D7 | **Snapshot links are view-only.** A snapshot is a frozen copy; commenting on or editing a copy that no longer matches the project makes no sense. The create rule refuses `kind = snapshot` with any permission but `view`. Comment and edit links are always live. | 3 |
| D8 | **What each link holder gets:** **view** (no account): the read-only viewer, media included. **comment** (signed in, verified): the read-only viewer plus each node's comments, where they can write and delete their own. **edit** (signed in, verified): the normal editor for that one project; they are not a team member, cannot trash or delete the project, and see it under **Shared with me** on the teams page. | 3, 4 |
| D9 | **A live view refreshes** by reading the share route again every 30 s while the tab is visible, and at once when it becomes visible. No live subscription for anonymous viewers (the SDK's event stream needs collection rules, which D2 keeps closed). | 4 |
| D10 | **Who manages links:** any member creates links (design 5) and revokes any link of the project; a revoked link cannot be un-revoked (make a new one). The snapshot is republished by `POST /api/kwnto/share-links/{id}/republish` (members). Revoking all links is the admin route `POST /api/kwnto/admin/share-links/revoke-all` (runbook control 6). | 3 |
| D11 | **Trash:** the server stamps `deleted_at` with its own time when a request sets it (Review Focus 2). Chapters and nodes are restored by any member (design 6.8), projects only by the owner (only the owner trashes them, Plan 3). A node whose chapter is trashed is restored with its chapter. A daily job `purge_trash` at `30 3 * * *` deletes projects, then chapters, then nodes whose `deleted_at` is older than `trash_retention_days`, 200 at a time; PocketBase's cascades remove their lines, cues, choices, comments, presence, links and media files; a choice pointing at a purged node becomes empty (Plan 3's open choices). There is no "delete for good" button (design 6.8: the purge or a backup). | 1 |
| D12 | **App settings for the browser:** `GET /api/kwnto/app-settings` (signed in) answers `{ trashRetentionDays, presenceTimeoutSeconds }`; `system_behavior` stays admin-only. | 1, 6 |
| D13 | **Comments:** `author_name` is copied from `users.name` by a hook (as `team_members.user_name`, Plan 2 D6), because commenters may not read each other's accounts. No editing (design 5: authors delete their own, the owner deletes any). Max 2,000 characters. A comment cannot be added to a trashed node. | 5 |
| D14 | **Presence:** one row per person and project (`project`, `node`, `user`, `user_name`, `field`, `beat`). While a field of the panel has focus the browser writes `{ node, field, beat + 1 }` every 10 s, and deletes its row on blur, on closing the project and on `pagehide`. Others show `<name> is editing` on the node card and beside that field, while the row's last event arrived less than `presence_timeout_seconds` ago **by the viewer's own clock** (so clock skew between machines does not matter). A job `purge_presence` every minute deletes rows not updated for twice the timeout. Presence is not queued offline. | 6 |
| D15 | **Carried over, built here:** live creates of teams and projects (Plan 3), the offline status following the event stream, an immediate retry when the stream reconnects, and the offline undo group (Plan 4). Plan 4's "smaller review findings" stay on the roadmap for a later polish plan; none loses data. | 7 |

## File structure

| Path | Responsibility |
|---|---|
| `backend/pb_hooks/lib/trash.js` | Pure: `serverDeletedAt`, `isExpired` |
| `backend/pb_hooks/lib/project-file.js` | Pure: `buildProjectFile`, `validateProjectFile`, `importPlan`, `FILE_LIMITS` |
| `backend/pb_hooks/lib/share.js` | Pure: `shareAccess`, `snapshotMediaIds` |
| `backend/pb_hooks/lib/presence.js` | Pure: `staleCutoffIso` |
| `backend/pb_hooks/trash.pb.js`, `project-file.pb.js`, `share.pb.js`, `comments.pb.js`, `presence.pb.js`, `app-settings.pb.js` | Hooks, routes and jobs |
| `backend/pb_migrations/1794400000_share_links.js`, `1794400100_link_grants_rules.js`, `1794400200_comments.js`, `1794400300_presence.js` | Collections and rule changes |
| `frontend/src/backend/` | `trash` (in `content.ts` and `projects.ts`), `projectFiles.ts`, `shares.ts`, `comments.ts`, `presence.ts`, `appSettings.ts` and their types |
| `frontend/src/features/trash/`, `projectFile/`, `share/`, `comments/`, `presence/` | Screens and their pure helpers |
| `tests/rules/` | `share_links`, `link_grants`, `comments`, `presence` rules files; `trash`, `project-file`, `share-access`, `share-routes` behaviour files; `helpers/share.ts` |
| `e2e/` | `trash.spec.ts`, `project-file.spec.ts`, `share-links.spec.ts`, `comments.spec.ts`, `presence.spec.ts` |

## Tasks

| # | Task | Tier | Depends on | Checkpoints | Status |
|---|---|---|---|---|---|
| 1 | [Trash: server time, restore and the purge](task-1-trash.md) | strong (1A local) | Plans 3, 4 | 1A 1B 1C | done |
| 2 | [Project files: export and import](task-2-project-file.md) | strong (2A mid) | 1 | 2A 2B 2C | awaiting review |
| 3 | [Share links on the server](task-3-share-server.md) | strong | 2 | 3A 3B 3C | not started |
| 4 | [Sharing screens and the read-only viewer](task-4-share-screens.md) | mid | 3 | 4A 4B 4C | not started |
| 5 | [Comments](task-5-comments.md) | strong (5C mid) | 3 | 5A 5B 5C | not started |
| 6 | [Presence](task-6-presence.md) | strong (6A local) | 3 | 6A 6B 6C | not started |
| 7 | [Carried over from Plans 3 and 4](task-7-carried-over.md) | strong | Plans 3, 4 | 7A 7B 7C | not started |
| 8 | [Close-out](task-8-closeout.md) | mid | 1 to 7 | 8A | not started |

**Status values:** `not started`, `in progress`, `awaiting review`, `done`. Run tasks one at a time (implementers never run in parallel). Task 7 depends on nothing in this plan and may be moved earlier.

Names and signatures shared between tasks are in each task file's **Interfaces** block. If a task needs something its Interfaces block does not list, stop and report it; do not guess.

**Closing a checkpoint** follows the Plan 1 router, "Rules while working". Replace its `<date>-foundation` with `2026-11-20-sharing`.

## Done when

- `npm test` passes on a clean clone with Docker running, and `npm run check:task` passed for every task (output in the reports).
- Every row above says `done` (or Tasks 6 and 7 are moved by D1 with the roadmap updated), no step box is unticked, `git status` is clean.
- [test-plan.md](../../../test-plan.md) rows "Trash and recovery", "Share links", "Project JSON import and export" and the new "Comments and presence" row say `covered`; security.md sections 2 and 5 (XSS, bad imports) no longer say **(planned)**; runbook control 6 is written.
- The roadmap marks Plan 7 `done`. A whole-branch review of `feat/sharing` is complete and the developer has reviewed the branch. Agents do not merge or push.
