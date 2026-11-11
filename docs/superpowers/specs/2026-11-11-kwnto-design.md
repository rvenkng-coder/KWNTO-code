# KWNTO Design

Date: 2026-11-11
Status: Approved 2026-11-11
Sources: client answers (Q1-Q37), `docs/user-requirements.md`, dev decisions in chat. Items marked **[my call]** were decided by the designer, not the client or dev; please review them.

## 1. Intent

KWNTO is an internal web tool for Multimedia Arts students (scriptwriters and game developers) to write branching, interactive scripts and plan A/V storyboards for capstone projects. Writers lay out scenes as nodes on a canvas, connect them to show choices, attach media, playtest the story, collaborate with teammates in real time, and export the branch map.

It is a new build. `branching_narrative_tool.tsx` is a throwaway prototype and a visual/feature reference only; no code is carried over.

It is an internal tool, not a public product (yet). It is used by one school cohort, not at scale.

## 2. Goals

- A usable, stable tool by the last week of November 2026 (hard deadline).
- Core authoring: nodes, connections, properties panel, chapters, search.
- Real-time team collaboration with sharing at three permission levels.
- Player Mode for playtesting and for viewers.
- Export of the branch map to PDF, Word, JPG, PNG.
- Cost: zero. Everything self-hosted on the developer's Proxmox server (see section 7).

## 3. Non-goals

- Variables, flags, scores, or conditional choices. Choices are plain links. (Client: this is only for script writing.)
- Node types (scene/choice/ending). Nodes are freeform with a title and color.
- In-browser audio recording. Upload only.
- Mobile/tablet support, other browsers than desktop Firefox and Chrome.
- Branding, localization (English only), accessibility targets beyond sensible defaults.
- Public sign-up, payments, plans, and a custom in-app admin page. The built-in PocketBase dashboard is the admin console for now. Comment replies and a "resolved" state are later additions.
- Migration of existing data (none exists).
- Embedding in Google Sites/iframe. It is a standalone page.
- **Full offline use (later, dev decision):** opening and using the app with no connection from a cold start (service worker / installable app), and offline upload queues for audio and video. Only connection-drop resilience (section 6.7) is in the MVP.

## 4. Anti-goals (would make it a failure even if it technically works)

- Losing a user's work: auto-save must be reliable and edits must not silently overwrite a teammate's work in a destructive way.
- Missing the deadline for an over-engineered feature set. Cut scope before cutting stability.
- Anything that needs a paid plan to keep running.

## 5. Users and access

- **Users:** students, plus the developer. Real sign-in by email and password, hashed/encrypted credentials, HTTPS.
- **Teams:** projects belong to a team (not an individual). Team members can edit the team's projects. A user can belong to several teams. The team creator is its owner. Members can create projects, edit every project in the team, upload media, comment, and **create share links** (dev decision). Only the owner removes members, regenerates or disables the join code, deletes projects and deletes the team. There are two ways to join: a **join code** (quick, for a whole class), and an **invite by email** (dev decision): the owner types an email and, if an account exists, an invite appears in that person's account the next time they sign in; they must **accept** before joining. No email is sent, so no email service is needed. If no account exists the owner sees "that user doesn't exist". Emails are private to everyone except the admin; an owner never sees an invitee's email list, only the name of someone who has accepted. The "doesn't exist" message lets a signed-in owner discover which emails are registered; this is a known, accepted risk, limited by a rate limit on invite attempts and a log of each attempt, and it is on the pre-public list (section 12).
- **Share links**, three permission levels: **view only**, **comment**, **edit**. Each link is one of two kinds:
  - **Live:** shows the current state of the project.
  - **Snapshot:** a frozen copy as of the moment it was published. The owner can **update** it (re-publish current state) and **revoke** it.
  - Both kinds can be revoked. **View links work without an account. Comment and edit links require sign-in** (dev decision). An edit link grants access to that one project only, not team membership.
- **Comments** (dev decision) attach to a specific node, shown as a flat list (oldest first) in the properties panel, with a count badge on the node. Authors delete their own; the team owner can delete any. No replies or resolved state in the MVP.
- **Concurrent edits (dev decision):** real-time multi-user editing, like Google Docs in spirit: edits are saved **per attribute**, so changes to different attributes or nodes never conflict and are merged automatically. Attributes are: node title, color, position, each script line, each A/V cue, each lighting note, each connection. Script is stored line by line so two people can edit different lines of the same node. Only two people editing the *same* attribute at once conflict; the later write wins, and the app shows a "someone else is editing this" indicator on that node/field (presence) so it rarely happens. No character-level merging.
- **Share link recipients (dev):** classmates, teachers or the public. View links work without an account, including media.

## 6. Product behavior

### 6.1 Canvas and nodes
- Infinite pan canvas on a repeating dot-grid background. Zoom is left to the builder.
- Freeform nodes: title, header/border color, text, height adjusts to content.
- Connections are lines between nodes, representing choices and scene progression. **Connections can link nodes in different chapters** (dev decision). Since a line cannot cross chapter tabs, a node has a "Link to a node in another chapter" action with a searchable picker; the link shows as a tag on the source node ("→ Chapter 2: The Door") that jumps to the target when clicked, and the same tag appears in exports **[my call on the UI]**.
- **One start node per project** (dev decision), marked by the author; default is the first node created. Chapters organize the canvas and are not separate stories.
- Undo/redo, copy/paste, multi-select, and a minimap are included.
- Header search jumps to a node by title, across all chapters.
- Dead-end nodes (no outgoing connection) are valid endings, shown with an "end" marker, not errors. **Unreachable nodes** (no incoming connection and not the start node) get a warning marker (dev decision). Neither blocks anything.
- No limits on node or chapter counts.

### 6.2 Properties panel
For the selected node: line-by-line script, A/V cues, lighting notes, and uploaded media.
- Audio: WAV, MP3.
- Video: MOV, MP4.
- Images: JPEG, PNG.
- Upload only. Storage cap: 2 GB per user, counting files a user uploaded across all projects. Over the limit, uploads are refused with a clear message and nothing is deleted.
- Per-file defaults: 200 MB for video, 50 MB for audio and images. **All limits and allowed file types are admin settings** (see section 7c).

### 6.3 Chapters
Projects contain chapters shown as tabs that can be resized and closed.

### 6.4 Player Mode
- Plays the story one node at a time with slide/fade page-turn transitions.
- Audio, video and images attached to a node play with it.
- Choices appear as buttons labelled with the connection's label, or the target node's title if none. A node with no outgoing link shows "The End". Play starts at the project start node and follows choices across chapters, showing the chapter name when it changes.
- Each node shows its script lines in screenplay style (character name, then the spoken text). Cues and lighting notes are for the crew and are not shown to players **[my call]**.
- Restart, step back, and a path history. **[my call on exact set; client said yes to all of: restart, back, history, media playback]**
- Used by authors for playtesting and by viewers via share links.
- **Analytics (client, dev):** anonymous per-choice counts with a random session id, shown on the map to the project owner (for example "62% chose A"). **Choices made while a signed-in team member plays are not recorded.**

### 6.5 Export
- **Formats:** PDF, Word (.docx), JPG, PNG.
- **Content:** the branching diagram only (node and branch map). Not script text or A/V cue lists.
- JPG/PNG are images of the map. PDF/Word are generated in-app (not via the browser print dialog) and contain the map as a high-resolution image. Accepted for now; vector output can be added later (dev decision).
- Scope: the current chapter by default, with an option for the whole project (one map per chapter); large maps are scaled to fit one image **[my call]**.
- Node labels on the map should be legible in the export.

### 6.7 Offline resilience (dev decision, MVP)

- Edits are written to local browser storage (IndexedDB) first and then synced to the server. If the connection drops while the app is open, or the browser is closed while offline, edits are kept and sync when the connection returns.
- The app shows an indicator ("offline, N changes waiting") and never loses queued edits.
- **Conflicts on sync:** each queued edit remembers the version it started from (PocketBase's `updated` time, **[my call]**). If someone else changed the same attribute in the meantime, the app warns and asks which version to keep, mine or theirs, showing both. Nothing is overwritten silently.
- This replaces last-write-wins for edits made offline. While everyone is online, live edits still merge per attribute with the presence indicator (section 5).
- Media uploads wait for the connection; they are not queued offline.
- Offline queueing and conflict handling are the highest-risk part of the editor, and need their own tests (section 8b).

### 6.8 Trash and recovery (dev decision)

- Deleting a **project, chapter or node** moves it to a trash instead of erasing it. Its contents (lines, cues, media, comments, connections) are hidden with it and come back with it.
- Items stay in the trash for **30 days**, then are deleted for good by a scheduled job, including their media files. The period is an admin setting (`trash_retention_days`, default 30).
- Any team member can restore from the trash while it lasts **[my call]**. After the 30 days, the only recovery is restoring from a backup, done by the admin.
- Trashed media still counts toward the uploader's quota until it is purged **[my call]**.
- A node's connections are hidden while the node is in the trash and return with it **[my call]**.
- Deleting a single script line, cue, comment or connection is covered by undo/redo only **[my call]**.

### 6.6 Look and feel
- Reference: the prototype's layout and Apple OS / Nothing OS feel. **Not** glassmorphism; no translucent or blurred panels.
- Layout: top bar (search, theme toggle), left (projects/chapters), center canvas with minimap, right properties panel.
- **Dark mode (client decision):** flat solid dark panels, thin borders, dot-grid canvas. The mockup lives in `.superpowers/brainstorm/` (option B).
- **Light mode (client decision):** white panels, soft shadows, dot-grid canvas (option C).
- Manual light/dark toggle in the top bar. **One blue accent in both modes** (dev decision; the mockup's red dark-mode accent is superseded). Node header colors are a user-chosen palette.
- The prototype look is "strict reference", not a spec.

## 7. Constraints and technical direction

- **Browsers:** desktop Firefox and Chrome, current versions.
- **Stack [dev decision: self-host everything, no Firebase]:** a React + TypeScript web app (dev decision), served from the developer's Proxmox server. Backend: a self-hosted all-in-one backend providing email/password sign-in, a database with real-time subscriptions, and file storage with access rules. **PocketBase is the decision**, with every backend call kept in one frontend module so the backend can be swapped later if a public release needs it (dev decision).
- **Frontend libraries:** React Flow (`@xyflow/react`) for the canvas (dev decision); Vite, Tailwind CSS and Zustand (with a history stack for undo/redo) **[my calls]**; image export with `html-to-image`, PDF with `jsPDF`, Word with `docx` **[my calls]**.
- **Hosting (dev decision):** everything runs on the developer's Proxmox server, made reachable to people without Tailscale through Tailscale Funnel (free). Cost rule: zero. Firebase is not used.
- **Backend must provide:** email/password sign-in with hashed credentials; team membership and share-link permission checks (view, comment, edit; live and snapshot; revocable); real-time updates so per-attribute edits reach teammates quickly; media upload and serving with the 2 GB per-user quota and file type/size validation; public read access for valid view links, including media.
- **Earlier Firebase findings (2026-11-11), kept for the record:** Cloud Storage for Firebase now requires the paid Blaze plan, and Firestore's free quota (about 20K writes/day) was a risk for live editing. These are why Firebase was dropped.
- **Security:** HTTPS everywhere, hashed credentials, server-side rules enforcing team membership and share-link permissions, upload type and size validation, regular backups.
- **Maintenance:** maintained by the developer, manually or with a local AI agent. Code should be conventional, documented, and easy for an agent to navigate. An `AGENTS.md` (currently empty) should be filled with project conventions. **[my call]**

## 7c. Admin console and settings (dev decision)

Anything that needs configuring is done in the **built-in PocketBase admin dashboard**, not a custom page. Settings are **separate tables by scope and by who may edit them**, with typed fields (see the ERD):

- **System, admin only, one record each:** `system_access` (registration open or closed), `system_storage` (default quota 2 GB, per-file limits 200 MB video and 50 MB audio and images, allowed file types), `system_behavior` (presence timeout, analytics retention, trash retention days).
- **User:** `user_preferences` (theme, minimap; edited by the user and saved to their account) and `user_limits` (quota override; admin only).
- **Team:** `team_settings` (join code, on or off; team owner).
- **Project:** `project_settings` (analytics on or off; team members).

Server rules read these values at run time, so changes need no redeploy. Defaults are created by committed migrations that only fill in missing values and never overwrite edits. The dashboard's own backup settings (schedule, retention, destination) are the backup config; the builder must confirm the current PocketBase version supports this, and add a script or command if it does not.

**Sign-in protection (dev decision):**
- After **3 failed sign-in attempts**, further attempts are refused with "try again after 5 minutes". Because this lets someone deliberately block a student's sign-in, the builder should count attempts per account and IP together where possible **[my call]**. Both numbers should be admin settings in `system_behavior` **[my call]**.
- **Password rules:** a minimum length and complexity. My proposal **[my call]**: at least 10 characters with a letter and a number, and rejection of very common passwords. Exact rules are set in the builder's plan and documented in `security.md`.
- **Hashing:** passwords use a deliberately slow hash. PocketBase uses bcrypt, to my knowledge, which is slow by design; the builder must confirm the algorithm and cost in the version used. Switching to a slower algorithm would need custom authentication and is not planned unless the check shows a weak setting.

**Outgoing email (dev decision):** password resets (and verification, if enabled) are sent through a free SMTP account, for example Gmail with an app password, configured in the PocketBase dashboard's mail settings. The credentials are secrets: they live in the database (so backups must be protected like secrets) or in `.env`; never in git. Free accounts have daily sending limits (about 500 a day for Gmail, from my knowledge; verify), which is enough for an internal tool. The deployment guide must explain creating the app password. If mail is down, the admin can still reset a password by hand.

**Sign-up (dev decision):** anyone can create an app account, and must **verify their email address** (a link sent by the outgoing email above) before they can create or join teams, upload media or use share links that need sign-in. The **admin account is created at installation/deployment**, as in other self-hosted services: the first-run setup (a documented command or a bootstrap script reading the admin email and password from the `.env` file, with the exact method left to the builder) creates it, and there is no default password. The admin signs in to the PocketBase dashboard, which is separate from the app's user accounts, so the admin does not need an app account. Because the app is public through Funnel and each account gets 2 GB, the `registration_open` switch lets the admin close sign-up, and the plan must include a total disk-usage warning **[my call]**.

## 7b. Deployment (dev decision unless marked)

- Runs on a **Proxmox VM** (not LXC) with Docker, so it can share the VM with other services later.
- **Docker Compose** is the deployment unit. One command starts everything; handover instructions are clone, set secrets, run.
- **App container [my call]:** the self-hosted backend serves both the built web app and the API.
- **Tailscale container [my call]:** runs alongside the app and publishes it over HTTPS with Funnel. Only that one port is exposed to the internet. Tailscale on the VM host is an acceptable alternative. HTTPS certificates are issued and renewed automatically by Tailscale; MagicDNS, HTTPS certificates and Funnel must be enabled in the Tailscale admin console and access policy. Known risk: Funnel's bandwidth limits may throttle large video; fallback is a Cloudflare Tunnel with a paid domain.
- **First run:** the deployment guide covers creating the admin account (see section 7c), enabling Funnel, and checking that the default settings were created.
- **Data** (database and uploaded media) lives in mounted volumes outside the containers, so updating a container never deletes data.
- **Backups (dev decision):** a script or command runs backups, with a config setting for the destination and how often, set by the admin. Defaults are left to the builder.
- **Container hardening [my call]:** non-root user, no privileged mode, secrets in an environment file kept out of git, images updated regularly. The container limits damage but does not replace the application-level permission and upload rules in section 7.
- Real-time updates must be tested through Funnel before relying on it.

## 8. Deliverables and acceptance

- Source repo with documentation.
- Deployment instructions, and a user manual **[client: "preferably"]**.
- **Documentation is part of done (dev decision):** every feature, setting and script is documented in `docs/` (user manual, admin/deployment guide, developer notes); nothing ships undocumented. The repo README and `AGENTS.md` are filled in.
- Acceptance: the developer signs off. **[my call]** Provide a manual test checklist covering each feature in section 6, run in Firefox and Chrome.

## 8b. Testing (dev decision)

Weighted toward where a bug would hurt most: permissions, saving, real-time editing. No coverage-percentage target, and few React component tests.

1. **Unit tests (Vitest):** the offline edit queue and conflict detection, undo/redo history, decimal sort order for script lines, building the branch-map data for export, JSON project import validation. Write the test first where logic is pure.
2. **Backend rule tests:** run against a real PocketBase in Docker, calling its API as different users. Cover team members vs outsiders, view/comment/edit share links, revoked links, live vs snapshot, the 2 GB quota, and file type/size limits. This is the most important layer.
3. **End-to-end tests (Playwright, Firefox and Chrome):** sign in, create and connect nodes, reload and confirm saved; go offline, edit, reconnect and confirm sync, and produce a conflict and confirm the keep-mine/keep-theirs prompt; two browsers editing the same node including the "someone else is editing" indicator; a share link opened without an account; JSON import then export.
4. **Manual checklist:** light/dark look, Player Mode transitions, PDF/Word/JPG/PNG exports. This is also the developer's sign-off sheet (section 8).
5. **One command** runs all automated tests locally.
6. **GitHub (dev decision):** a workflow runs the unit, backend rule and Playwright tests on every push, starting PocketBase inside the workflow. It also runs a documentation check **[my interpretation]**: markdown links resolve, and a pull-request checklist requires docs updates for any feature, setting or script changed. The builder may add stricter checks.

## 9. Left to the builder

Exact data model, team invite flow, zoom behavior, undo history depth, conflict handling details beyond last-write-wins, export library choices, minimap behavior, comment UI, UI component library, code layout, test tooling details beyond section 8b.

## 9b. Further decisions

- **Snapshots** (my call) reference media rather than copy it, do not count toward quota, and show a "media removed" placeholder if the file is later deleted.
- **Quota** (my call) is per uploading user. Removing a user's files is a manual maintenance task.
- **Connections** belong to the project and can link any two of its nodes, including across chapters. Each has an optional label (the choice text); if empty, Player Mode shows the target node's title.

## 9c. Data model (proposal, PocketBase on SQLite, relational) **[my call unless marked]**

PocketBase stores data in SQLite, so the model is relational. Each independently editable piece is its own field or record, which is what makes per-attribute live editing work.

| Collection | Holds |
|---|---|
| users | Built in: email and password. |
| team_invites | Pending invite: team, invited user, invited by, status (pending, accepted, declined), time. |
| teams, team_members | Team with an owner; members link a user to a team (role: owner or member). |
| team_settings | One per team: join code, code on or off. Owner edits. |
| projects | Belongs to a team: name, created date, start node, `deleted_at` (trash). |
| chapters | Belongs to a project: title, tab order, `deleted_at`. |
| nodes | Belongs to a chapter: title, color, x and y position, height, `deleted_at`. |
| script_lines | Belongs to a node: **character name (optional) and line text**, sort order. One record per line. |
| cues | Belongs to a node: type (audio, lighting, other), text, sort order. |
| media | Belongs to a node: file, type, size, uploader (drives the 2 GB quota). |
| connections | Belongs to a project: from node, to node (any chapter), optional choice label. |
| comments | Belongs to a node: author, text, time. |
| share_links | Belongs to a project: random token, permission (view, comment, edit), kind (live, snapshot), revoked flag, frozen JSON copy for snapshots. |
| path_events | Anonymous player choices: project, connection, random session id, time. Not written for signed-in team members. |
| user_preferences, user_limits | One each per user. Preferences (theme, minimap) are edited by the user; limits (quota override) by the admin only. |
| project_settings | One per project: analytics on or off. Team members edit. |
| system_access, system_storage, system_behavior | One record each, admin only (section 7c). |

- **Screenplay-style lines (client decision):** each line has a character name and the spoken text. A line with no character name is treated as action or narration **[my guess]**. The properties panel suggests character names already used in the project **[my call]**.
- Sort order uses decimal positions so inserting a line changes only one record.
- Node drag positions are saved when the drag ends, not continuously.
- "Someone else is editing this" is not built into PocketBase. It uses a short-lived presence collection with a heartbeat, cleaned up by a scheduled job.
- **Risk to test first:** PocketBase real-time subscriptions on a large project (hundreds of nodes, thousands of records) with several editors. Run a throwaway test of two or three browsers editing the same node before building on it.

## 10. Resolved items and remaining open items

Resolved by the developer and client:
- **Backups:** the deployment includes a script or command that runs backups, with a config setting for the backup destination and how often it runs, set by the admin. Defaults for destination and frequency are left to the builder.
- **Public access:** Tailscale's free Funnel. The video-throttling risk and Cloudflare Tunnel fallback stay noted in section 7b.
- **Analytics (client):** anonymous per-choice counts.
- **Import/export of projects:** a JSON file of the project itself. This is a project import and export in addition to the PDF, Word, JPG and PNG exports.
- **Load testing:** large-scale load testing is deferred until there is time. A small throwaway real-time test (two or three browsers editing the same node) is still the first step of the plan, because the data model depends on it **[my call]**.

Remaining open: none. Every decision above was settled in chat on 2026-11-11.

## 12. Before going public (dev decision: revisit when the tool is opened to the public)

- Account enumeration through the invite-by-email message (section 5).
- Open sign-up on a public address, and the disk-abuse risk of 2 GB per account.
- PocketBase scale limits (single server, SQLite) and the option to swap the backend (section 7).
- Tailscale Funnel bandwidth limits for large media, and the Cloudflare Tunnel fallback.
- Full offline use (section 3), and a custom in-app admin page.
- A fresh security review of the access rules, and a re-check of the "internal tool" assumptions made here.

## 11. Build order (dev decision, MVP first)

1. **The editor itself and reliable saving** (canvas, nodes, connections including cross-chapter links, properties panel, chapters, search, undo/redo, copy/paste, multi-select, minimap, light/dark mode, sign-in, teams, media upload, offline resilience per section 6.7). This alone is the MVP. It begins with the small throwaway real-time test in section 9c.
2. **Access for other users and data safety:** trash and restore (section 6.8), share links (view, comment, edit), opening shared projects, JSON project import and export, comments, real-time collaboration with presence.
3. **Export** (PDF, Word, JPG, PNG).
4. **Player Mode.**
5. **Path analytics,** last.

If time runs out, cut from the bottom. Testing (section 8b) and documentation (section 8) happen alongside every step, not at the end.
