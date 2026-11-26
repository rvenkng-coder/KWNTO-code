# M8 and M9: scripted walk of design section 6

Two Playwright scripts that walk the app through the features of design section 6 (plus sharing, teams, import/export and the admin security log) in one browser at a time. Run on 2026-11-26 against a demo copy of the app (dev server on 5190, a separate PocketBase on 8093 with its own data), in Playwright's Chromium and Firefox builds. Not Google Chrome.

- `walk.mjs`: one person. Canvas, nodes, choices, markers, undo/redo, copy/paste, minimap, search, script lines, cues, media, links, chapters, cross-chapter link, trash, Player Mode, four export formats, theme, offline, JSON import/export, a view link. 31 steps.
- `walk2.mjs`: several people and the admin. Team, join code, invites, presence, live edits, offline conflict, comments, removed media, file and quota limits, tab resize, chapter and project trash, zoom, whole-project export, snapshot (with Republish and Revoke), comment and edit links, the PocketBase security log. 21 steps.
- `walk*-<browser>.json`: the result of each run. All 52 steps passed in each browser.

Run: `node walk.mjs chromium|firefox`. They are scratch tools, not part of the test suite: they use absolute paths of the machine they were run on, expect the demo app on `localhost:5190` with the seeded `demo@kwnto.test` account, and read the admin login from `.env`.

**Not walked:** path analytics (not built, Plan 10), the 30-day purge job, video upload (switched off by decision), account lockout and the incident controls, removing a member and deleting a team, declining an invite, import validation errors. Most of these are covered by the automated suite.

**Seen along the way:** going offline logs an uncaught `ClientResponseError 0: Something went wrong.` from the PocketBase client (`RealtimeService.finalizePendingSubscriptions`) in both browsers; occasional `400` on a presence write in Chromium; the expected `409` guarded-write retries. See issue 26 for the nearby stall.
