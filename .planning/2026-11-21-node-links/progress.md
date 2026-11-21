# Progress: node links and video uploads off

Plan: [docs/superpowers/plans/2026-11-21-node-links](../../docs/superpowers/plans/2026-11-21-node-links/README.md)

| Date | Task | Built by | What happened | Review | Escaped | Next |
|---|---|---|---|---|---|---|
| 2026-11-21 | Plan written | - | Design approved by the developer; plan written (4 tasks) | none | 0 | Task 1 |
| 2026-11-21 | Task 1, checkpoints 1A and 1B | strong | acceptFor and picker; migration 1794400000 removes mov and mp4; 3 approved test edits plus 2 more message-only edits (ruling, developer approved); probes written by the author | none | 0 | Task 2 |
| 2026-11-21 | Task 2 | strong | node_links migration 1794400100, link-check.js, links.pb.js, 6 rules tests, 3 unit tests, breaks 3 caught, check:task PASS | none | 0 | Task 3 |
| 2026-11-21 | Task 3 | strong | client link check, links door (list, add, remove, subscribe), parity rules test, 3 unit and 3 rules tests, breaks 3 caught, check:task PASS (client regex written without useless escapes, ruling in ledger) | none | 0 | Task 4 |
| 2026-11-21 | Task 4 | strong | linksOf, applyLinkEvent, links store, LinksSection and LinkItem, useOnline moved, 4 e2e tests, docs (user guide, security, ERD, test plan M13, roadmap) | none | 0 | whole-branch review |
| 2026-11-21 | Whole-branch review, closeout | strong | Fable review: 0 Critical, 2 Important (stored non-web URL rendered; double submit), both fixed RED to GREEN; long-title message, design spec and roadmap notes done; merged into feat/deployment; full suite green (702 unit, 43 container, 234 rules, 228 e2e); closed by the developer with the deployment plan. M13 open | clean | 0 | merge to main (developer) |
