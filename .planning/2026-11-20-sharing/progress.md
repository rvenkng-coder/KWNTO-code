# Trash, share links, comments, presence and project files: progress

| Date | Task | Built by | What happened | Review | Escaped | Next |
|---|---|---|---|---|---|---|
| 2026-11-20 | Plan written | - | Router and 8 task files written on feat/sharing; check:plan ok; awaiting developer review of decisions D1 to D15 | - | - | developer reviews the plan |
| 2026-11-20 | 1A | strong (1A is nominally local; done by the strong agent) | trash.unit.test.ts failed (module missing), then passed 1/1 after lib/trash.js | none | 0 | 1B: rule tests, stamp, purge job, app-settings |
| 2026-11-20 | 1B wip | strong | trash.rules.test.ts 5/5 pass alone (opened project update rule: C5 failed, restored); full test:rules: 3 older tests fail because they assert a client-sent deleted_at is stored (chapters.rules 'members create, rename and trash chapters' line 86, nodes.rules 'nodes are trashed by members and purged only by the server' line 114, projects.rules 'only the team owner moves a project to the trash' line 68); not edited, awaiting controller decision | none | 0 | decide how those 3 assertions change; then docs, close 1B |
