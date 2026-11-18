# Editor tabs and Add node: progress

| Date | Task | Built by | What happened | Review | Escaped | Next |
|---|---|---|---|---|---|---|
| 2026-11-18 | Plan written | - | Design approved; layout fix (full window) committed first as 7b33c14; plan of 3 tasks written | - | - | Task 1 |
| 2026-11-18 | 1A | strong | menuPosition: 4 unit tests failed first (module missing), then passed | none | 0 | 1B |
| 2026-11-18 | 1B | strong | Tab bar: ≡, ▾ menus in a portal, +; left list removed. 1B.2 RED (12/12); clip reproduced by probe. Flow walked by script (2 browsers × 2 themes): 0 hidden menu items; found and fixed the Chromium scroll-close bug (C13, C14). check:task PASS. [Report](reports/task-1-final.md) | none | 0 | Task 2 |
| 2026-11-18 | 2A | strong | newNode: 4 unit tests RED (module missing) then GREEN; createAt uses newNodeRecord; editor-canvas e2e 8/8 | none | 0 | 2B |
| 2026-11-18 | 2B | strong | Add node button: hint, disabled with no chapter; 2B.2 RED (6/6), still RED after the button until the queued fitView was cancelled in useAddNode; first attempt (no fit on empty chapters) reverted, it broke the panel cues test layout. Flow walked by script. check:task PASS. [Report](reports/task-2-final.md) | none | 0 | Task 3 |
| 2026-11-18 | 3A | strong | Docs written (user, developer, roadmap). npm test run twice: both exit 0 (589 unit, 5 container, 186 rules, 130 e2e). check:task PASS. Developer's Flow walk NOT done: awaiting their confirmation before the plan is marked done. [Report](reports/task-3-final.md) | none | 0 | developer walks the Flow |
| 2026-11-18 | final review | strong | Fresh reviewer: 0 Critical, 1 Important (long All chapters list ran off the window; fixed with e2e C15, RED→GREEN), 6 Minor deferred in the ledger only. npm test exit 0 (132 e2e). | found 1 | 0 | developer walks the Flow |
