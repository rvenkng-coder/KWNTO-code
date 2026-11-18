# Task report: Task 6 (nodes, script lines, cues, connections, start node)

Task file: docs/superpowers/plans/2026-11-14-editor-core/task-6-nodes-lines-connections.md
Built by: strong (one session, base `8945421`), checkpoints 6A and 6B

## Commits on `feat/editor-core`

| Commit | What |
|---|---|
| a9d05d6 | `feat: nodes, script lines, cues and connections` (6A) |
| 33b40d0 | `feat: first node becomes the start node` (6B, ERD, backend.md) |
| (this commit) | report and progress row |

## What was built

- `backend/pb_migrations/1794370100_nodes_lines_connections.js`: `nodes`, `script_lines`, `cues` and `connections`, with fields, rules and indexes as in the Interfaces block. Each create rule checks its references with `@request.body.<relation>.project = @request.body.project`. Each update rule refuses `project` and every reference field. `nodes` delete is `null`. The unique index is on `(from_node, to_node)`. `projects` gains `start_node` (no cascade), and its update rule gains `start_node` unset, empty or `@request.body.start_node.project = id`. The migration appends this to the stored rule and strips it on the way down, so it holds no copy of the old rule.
- `backend/pb_hooks/projects.pb.js`: `onRecordCreate` on `nodes` sets an empty `start_node` and adds 1 to the project's version, in the node's transaction.
- `tests/rules/helpers/content.ts`: `createNode`, `createLine` (the Interfaces), and also `memberProject`, `clientId` and `saveOwnFields(pb, collection, …)` (the decision 0002 client loop, made generic over the collection).
- Tests: `tests/rules/{nodes,script_lines,cues,connections}.rules.test.ts` (C1 to C11, C14, C15) and C12 and C13 in `tests/rules/projects.rules.test.ts`.
- Docs: in the ERD, `nodes.height` is gone and the `nodes.color` values are listed. New notes cover connection uniqueness and self-links, `project` on `connections`, the reference rules, the start node and client-made ids. `docs/developer/backend.md` has a new section, "References stay in their project", and the start-node hook in the hooks table.

## Extra tests beyond the Test plan

- **`nodes.rules.test.ts` :: deleting a team removes its projects with their nodes** (plan D13). Now that `projects.start_node` and `nodes.project` point at each other, deleting a team must still go through. It passes.
- **`cues` and `connections` outsider tests.** The plan lists outsider cases for nodes only (C5). The same checks were added for cues and connections.

## TDD record

- **6A:** all 16 new rule tests failed first ("Missing or invalid collection context": no collections yet). After the migration was written, 16 of 16 passed on the first run.
- **Step 3:** 0.40.6 resolves `@request.body.<relation>.project` on create, and C2, C6 and C10 refuse foreign references. So no `content-refs.pb.js` and no `findings.md` were needed.
- **Step 4 (open rule):** the reference check was dropped from the `script_lines` create rule. C6 failed with `AssertionError: the create was allowed: expected null not to be null`. The rule was then restored (checked with grep).
- **Rules suite after 6A:** 176 passed.
- **6B:** C12 failed first (`start_node` stayed empty) and so did C13 (`expected [ 403, 404 ] to include 200`: the foreign start node was accepted). After the hook and the rule change, both passed, together with the rest of the projects and nodes files (14 of 14).

## Step 9: `npm test`

- Lint, typecheck, unit (509), container (5) and rules (178) passed.
- **e2e: 2 failed and 50 passed.** The two failures were in Firefox, `e2e/accounts.spec.ts`: "wrong code and regenerate" (timed out waiting for `session-user` after sign-in) and "only owner sees owner controls" (the `Disable` button never showed). This task touches neither screen nor its backend.
- In that run the suite took 1.3 min against 25 s normally, so the machine was likely loaded.
- Rerun: `npm run test:e2e` passed 52 of 52. `accounts.spec.ts --project firefox --repeat-each 10` passed 100 of 100.
- The failure did not reproduce, so it is recorded here as a flake.

## `check:task` output

```
> kwnto@0.0.0 check:task
> node scripts/check-task.ts --task docs/superpowers/plans/2026-11-14-editor-core/task-6-nodes-lines-connections.md --base 8945421 --built-by strong

PASS plan
PASS lint
PASS typecheck
PASS unit
PASS layers: rules: passed; e2e: not required by this task's test plan; container: not required by this task's test plan
PASS hygiene
PASS quality: check:quality: ok
PASS coverage: 15 cases point at tests that exist
PASS breaks: run-breaks: no breaks listed
PASS probes: the Test plan names no probe folder (none)
INFO review: Review required: no (built by a strong model; the plan's own per-task review applies); escape rate 4 of 5 local tasks

check:task: PASS
```
