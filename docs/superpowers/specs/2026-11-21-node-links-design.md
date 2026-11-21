# Node links and video uploads off (design)

Status: approved by the developer on 2026-11-21 (short design).

## Intent and why

A 150 MB video upload does not finish through Tailscale Funnel on the first VM (measured on 2026-11-21: about 0.2 MB/s, browsers give up or Caddy times out; see the deployment progress notes). Chunked upload would make it survive stalls but not faster, and it is a large build. For now the developer chooses to stop accepting video files and let writers link to a video (or any other material) instead.

## Goals

- Video files (`mp4`, `mov`) are no longer accepted. Audio and images stay.
- Each node has a "Links and other material" section: a list of items, each with a title and a web address. Any team member can add and delete them.

## Non-goals

- Chunked or resumable upload (stays an open roadmap item, Plan 6 D13).
- Link previews, fetching the target page, embedding or playing a linked video.
- Share-link viewers seeing links (comes with the sharing plan).
- A hide-and-restore step for links (media has one; a link is only text).

## Anti-goals

- A `javascript:`, `data:` or other non-web address that runs when clicked. This is a failure even if everything else works.
- A way to upload a video around the switch (every route that creates media obeys it).

## Constraints

- Only `frontend/src/backend/` imports `pocketbase`; files max 300 lines; no `any`; deny by default rules (AGENTS.md).
- New collection needs a migration and a `tests/rules/<name>.rules.test.ts` covering list, view, create, update, delete for anonymous, other user, owner and injection.
- No new dependencies.

## Approaches considered

1. **Chunked upload** (what the developer first asked for): new start, piece and finish routes, reassembly on the server, the existing media checks re-run at the end. Survives stalls, shows progress, but does not make the transfer faster (150 MB still takes 12 to 14 minutes at the measured speed) and is a large build. Not chosen for now.
2. **Fix the network path** (direct Tailscale connection, host networking): separate, still open, not part of this work.
3. **Switch videos off and add links** (chosen): small, removes the failing case, gives writers a workable way to reference videos.

## Design (the developer's decisions, then my calls marked)

**Videos off.**
- Remove `mp4` and `mov` from `system_storage.allowed_types`: a new migration updates the existing row, and the default for fresh installs changes. [my call: both video types, because the reason covers both]
- The upload check, the file picker and the error messages already read `allowed_types`, so they follow the setting. The plan must confirm this by test, including a server-side refusal of an `mp4` even if the client is bypassed.
- The admin can turn video back on in the dashboard later.

**Links.**
- New collection `node_links`: `project`, `node`, `creator` (relations as in `media`), `title` (text, max 120), `url` (text, max 2000), `created`. [my call on field names and limits]
- Rules like `media`: members of the project's team, verified account; no update rule (delete and add again); delete by any member. No quota use. It is deleted with its node, project and team (cascade).
- The server accepts only `http://` and `https://` addresses (hook on create). The client checks the same rule and shows a message. [developer decision: web addresses only]
- UI: a section under the media in the node's panel (`MediaSection.tsx` neighbour): the list (title, host name, delete button), and an add form (title optional, address required). Links open in a new tab with `rel="noopener noreferrer"`.
- Door: new methods in `frontend/src/backend/` (list, add, remove, subscribe like media); the UI never imports `pocketbase`.
- Trash: a link follows its node, as media does.

## Left to the builder

Exact component split, the title fallback (host name when no title), live update behaviour (follow media's subscription), and documentation updates (user guide, test plan, ERD, roadmap).

## Process

Own plan and own worktree (`../KWNTO-code-links`, branch `feat/node-links`, started from `main`).
