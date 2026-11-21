# KWNTO Project Test Plan

Which test layers must cover each feature, and how far each feature is. The layers and their names are defined in [testing-strategy.md](testing-strategy.md) section 2.

## How to read it and who updates it

- **One row per feature**, at feature level. Detailed cases do not belong here (they go stale); they go in each task's Test plan block.
- **`layers required`** names the layers from the strategy (`unit`, `rules`, `e2e`, `container`, `manual`). For a `covered` row it lists the layers that have tests today.
- **`status`:** `not started`, `in progress` (a plan is building it) or `covered` (every required layer has a passing test, or a signed-off manual item).
- **Who updates it:** each plan updates its own rows, and adds rows for features it finds, in the commit that lands the plan. A row says `covered` only when the tests exist.
- **`design`** is the section of the [design](superpowers/specs/2026-11-11-kwnto-design.md); **`plan`** is the plan number from the [roadmap](superpowers/plans/README.md).

## Feature table

| feature | design | layers required | status | plan |
|---|---|---|---|---|
| Sign-up and verification (verified flag forced off, verification gate) | 5, 7c | rules, e2e | covered | 2 |
| Password rules (sign-up and change; reset by the admin was walked by hand in Plan 2, a reset by mail is M11) | 7c | unit, rules, e2e | covered | 2 |
| Sign-in and sessions (refresh, reload, sign-out) | 5 | unit, rules, e2e | covered | 2 |
| Lockout after failed sign-ins | 7c | unit, rules, e2e | covered | 2 |
| Block and lockdown | 7c | rules | covered | 2 |
| Incident controls (sign out one or all, runbook) | 7c | rules, manual (runbook walked in Plan 2) | covered | 2 |
| Teams and members (create, remove, delete, owner-only controls) | 5 | unit, rules, e2e | covered | 2 |
| Join code (on and off, regenerate, guess limit) | 5 | unit, rules, e2e | covered | 2 |
| Invites (send, accept, decline, no email leak, shared limit) | 5 | unit, rules, e2e | covered | 2 |
| Security log and its retention | 6.9 | unit, rules | covered | 2 |
| Per-user and system settings | 7c | unit, rules | covered | 2 |
| Canvas and nodes (connections, cross-chapter links, start node, end and unreachable markers, undo/redo, copy/paste, multi-select, minimap, search, two people editing live) | 6.1, 8b | unit, rules, e2e | covered | 3 |
| Choices on cards (empty, link, re-link, unlink, one per target), cues on cards, tool strip, Cut, area select, collapsible left panel, scrolling panels, soft look: `e2e/editor-choices.spec.ts`, `editor-tools.spec.ts`, `editor-look.spec.ts` | 6.1 | unit, rules, e2e | covered | editor cards |
| Properties panel: script lines, cues, lighting notes; the Choices section and link mode: `e2e/editor-choices-panel.spec.ts` | 6.2 | unit, rules, e2e | covered | 3 |
| Properties panel: media upload, quota, strict file checks | 6.2 | unit, rules, e2e | covered | 5 |
| Chapters | 6.3 | unit, rules, e2e | covered | 3 |
| Player Mode | 6.4 | unit, e2e, manual | not started | 9 |
| Path analytics (anonymous per-choice counts) | 6.4 | unit, rules, e2e | not started | 10 |
| Export (PDF, Word, JPG, PNG): `exportPlan.test.ts`, `documents.test.ts`, `e2e/editor-export.spec.ts`, `e2e/editor-export-project.spec.ts`; manual M4 to M7 `done` 2026-11-21 | 6.5 | unit, e2e, manual | covered | 8 |
| Look and feel (light and dark, theme toggle, layout) | 6.6 | e2e, manual M1 and M2 (signed 2026-11-18) | covered | 3 |
| Offline queue, sync and conflicts: `e2e/editor-offline.spec.ts`, `e2e/editor-conflicts.spec.ts` | 6.7 | unit, rules, e2e | covered | 4 |
| Deployment (proxy, headers, rate limits, backups and restore, storage warning) | 7b, 7c | container, rules, unit, manual | covered | 6 |
| Node links and video uploads off (plan 2026-11-21-node-links): `tests/hooks/link-check.unit.test.ts`, `tests/rules/node_links.rules.test.ts`, `tests/rules/links-door.rules.test.ts`, `tests/rules/video-off.rules.test.ts`, `e2e/editor-links.spec.ts` | 6.2 | unit, rules, e2e, manual M13 | covered (M13 open) | node-links |
| Trash and recovery (30 days, restore, purge) | 6.8 | unit, rules, e2e | not started | 7 |
| Share links (view, comment, edit; live, snapshot; revoke) | 5, 6.9 | rules, e2e | not started | 7 |
| Project JSON import and export | 8b | unit, e2e | not started | 7 |
| Project activity history | 6.9 | to be decided | not started | later (no plan) |

The Deployment row is `covered` for its container, rules and unit layers. The developer reported on 2026-11-21 that the [first walk](admin/deployment.md#the-first-walk-for-the-developer) works on the real VM; cases C1, C2, C5 and C6 are recorded as passed (M10, M11 and M12 included; no per-case detail was recorded), C3 (150 MB upload) was tried and failed (video upload is now off, plan node-links), and C4 (visitor's IP) is not yet run. Case C7 (backup and restore on the VM) was run on 2026-11-21 and passed (see `.planning/2026-11-20-deployment/progress.md`; the VM held no media, which the container test covers). Plan 6 was closed by the developer on 2026-11-21; C4 (the visitor's address from a phone) and M13 stay open as manual items.

## Manual sign-off checklist

Design sections 8 and 8b make this the developer's sign-off sheet. A person runs each item and marks it `done` with the date; until then it is `open`.

| # | Item | Source | Status |
|---|---|---|---|
| M1 | Light mode looks as designed (white panels, soft shadows, dot grid, one blue accent) | 6.6, 8b | done 2026-11-18 |
| M2 | Dark mode looks as designed (flat solid panels, thin borders, dot grid, one blue accent) | 6.6, 8b | done 2026-11-18 |
| M3 | Player Mode slide and fade transitions | 6.4, 8b | open |
| M4 | PDF export: map legible, current chapter and whole project (run by Claude Code on a seeded project (three nodes with lines, cues, choices and a cross-chapter link, a second chapter, a dark-theme account) in Chromium and Firefox; files rendered with poppler `pdftoppm` and read: titles, three-line previews, cues, choices, the `→ The Harbour: The Dock` tag, labelled connections and the page headings are legible on a white page; whole project gave 2 pages. Not opened in Adobe Reader) | 6.5, 8b | done 2026-11-21 |
| M5 | Word export: map legible, current chapter and whole project (run by Claude Code on a seeded project (three nodes with lines, cues, choices and a cross-chapter link, a second chapter, a dark-theme account) in Chromium and Firefox; opened by converting with LibreOffice and reading the pages: landscape, a heading and the map per chapter, 2 pages for the whole project. Not opened in Microsoft Word) | 6.5, 8b | done 2026-11-21 |
| M6 | JPG export: map legible (run by Claude Code on a seeded project (three nodes with lines, cues, choices and a cross-chapter link, a second chapter, a dark-theme account) in Chromium and Firefox; the 1368 × 922 JPG was read in an image viewer: complete and legible, white background) | 6.5, 8b | done 2026-11-21 |
| M7 | PNG export: map legible (run by Claude Code on a seeded project (three nodes with lines, cues, choices and a cross-chapter link, a second chapter, a dark-theme account) in Chromium and Firefox; the 1368 × 922 PNG was read in an image viewer: complete and legible, white background) | 6.5, 8b | done 2026-11-21 |
| M8 | Every feature in design section 6 tried by hand in Firefox | 8 | open |
| M9 | Every feature in design section 6 tried by hand in Chrome | 8 | open |
| M10 | A real verification email arrives and its link verifies the account (Plan 6 wrote the guide and the screens; reported passed by the developer on 2026-11-21, walk case C5) | Plan 2 | done 2026-11-21 |
| M11 | A real password-reset email arrives, also for an address typed with capitals, and its link sets the new password (Plan 6 wrote the guide and the screens; reported passed by the developer on 2026-11-21, walk case C5) | Plan 2 | done 2026-11-21 |
| M12 | Reconnect through Tailscale Funnel: with the app behind Funnel, drop one laptop's network for 10 seconds while a teammate edits; after reconnecting the teammate's edit appears within a few seconds without a reload and the edits made during the drop are saved (done 2026-11-20 through `tailscale serve` on the tailnet: passed; repeated behind the public Funnel address: reported passed by the developer on 2026-11-21, Plan 6 case C6) | 6.7 | done 2026-11-21 |
| M13 | On the VM, add a link to a real video to a node, click it (opens in a new tab, the app tab stays), and see `javascript:alert(1)` refused | node-links | open |
