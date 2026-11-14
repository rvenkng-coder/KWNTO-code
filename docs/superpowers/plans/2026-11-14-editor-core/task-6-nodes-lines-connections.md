# Task 6: Nodes, script lines, cues, connections

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Task 5

**Files:**
- Create: `backend/pb_migrations/1794370100_nodes_lines_connections.js`, `tests/rules/nodes.rules.test.ts`, `tests/rules/script_lines.rules.test.ts`, `tests/rules/cues.rules.test.ts`, `tests/rules/connections.rules.test.ts`
- Modify: `backend/pb_hooks/projects.pb.js` (start node), `tests/rules/projects.rules.test.ts` (add C12, C13), `tests/rules/helpers/content.ts` (add helpers), `docs/superpowers/specs/2026-11-11-kwnto-erd.md` (drop `nodes.height` D9, `nodes.color` values, connection uniqueness, `project` on `connections`), `docs/developer/backend.md`

**Interfaces:**
- Consumes: the Task 5 rule fragments, `GUARDED` (already lists these four), `createProject`, `guardedUpdate`, `readAsAdmin`.
- Produces: collections (each with `version` as in Task 5, plus `created` and `updated` autodate):
  - `nodes`: `project` (relation, required, cascade), `chapter` (relation `chapters`, required, cascade), `title` (text, max 200, may be empty), `color` (select: `slate`, `red`, `orange`, `amber`, `green`, `teal`, `blue`, `purple`; required), `x`, `y` (number), `deleted_at` (date).
  - `script_lines`: `project`, `node` (relation `nodes`, required, cascade), `character` (text, max 80), `text` (text, max 5000), `sort_order` (number, decimal).
  - `cues`: `project`, `node`, `type` (select `audio`, `lighting`, `other`; required), `text` (text, max 2000), `sort_order`.
  - `connections`: `project`, `from_node`, `to_node` (relations `nodes`, required, cascade), `label` (text, max 200). Unique index on `(from_node, to_node)`. A connection from a node to itself is allowed.
  - `projects.start_node`: relation `nodes`, optional, no cascade (a purged node empties it).
- Produces: rules. List and view: project member. Create: project member, `version` and `deleted_at` unset, and every reference in the body belongs to the body's `project` (`@request.body.chapter.project = @request.body.project`; for lines and cues `@request.body.node.project`; for connections both `from_node` and `to_node`). Update: member, `version` set, `project` not set, and the reference fields (`chapter`, `node`, `from_node`, `to_node`) not set. Delete: `nodes` `null` (trash is `deleted_at`); `script_lines`, `cues`, `connections` member. `projects` update gains: `start_node` unset, empty, or `@request.body.start_node.project = id`.
- Produces: a node created in a project whose `start_node` is empty becomes its start node, in the same transaction as the node, and the project's `version` goes up by 1 (`projects.pb.js`, D7).
- Produces: a client-chosen `id` (15 characters `a-z0-9`) is accepted on create for all four collections, so a deleted line, cue or connection can be re-created with its old id (undo, Task 12).
- Produces, `tests/rules/helpers/content.ts`: `createNode(user: TestUser, projectId: string, chapterId: string, extra?: Record<string, unknown>): Promise<string>` and `createLine(user: TestUser, projectId: string, nodeId: string, extra?: Record<string, unknown>): Promise<string>`.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 6A: The four collections and their rules

- [ ] **Step 1: Write the failing rule tests** C1 to C11 and C14 to C15 in the four new files (headers cite design 5 "save per attribute" and security.md section 2), and the two helpers.
- [ ] **Step 2: Run** `npm run test:rules`. Expected: the new files FAIL.
- [ ] **Step 3: Write the migration.** The reference checks use `@request.body.<relation>.project`. If 0.40.6 refuses that form or C2, C6 or C10 still pass a foreign reference, stop using the rule for it: add an `onRecordCreateRequest` hook `backend/pb_hooks/content-refs.pb.js` that loads the referenced records and answers 400 `That record belongs to another project.`, and record the finding in `findings.md`.
- [ ] **Step 4: Run** `npm run test:rules`. Expected: PASS. Open the `script_lines` create rule once (drop the reference check), see C6 fail, restore; report it.
- [ ] **Step 5: Close checkpoint 6A** (commit `feat: nodes, script lines, cues and connections`).

## Checkpoint 6B: Start node

- [ ] **Step 6: Write the failing tests** C12 and C13 in `tests/rules/projects.rules.test.ts`.
- [ ] **Step 7: Run** them. Expected: FAIL.
- [ ] **Step 8: Implement** the start-node part of `projects.pb.js` (`onRecordCreate` on `nodes`: open the transaction, `e.next()`, then read the project; if `start_node` is empty set it, add 1 to `version`, save) and the `projects` rule change in this task's migration.
- [ ] **Step 9: Run** `npm run test:rules`, then `npm test`. Expected: PASS. Update the ERD and `docs/developer/backend.md` (the reference rules, the start-node hook). **Close checkpoint 6B** (commit `feat: first node becomes the start node`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | a member creates a node with a client id | rules | create with `id: 'abcdefghijk0123'`, `color: 'blue'` | 201 with that id, `version` 0 | tests/rules/nodes.rules.test.ts :: a member creates a node with the id the client chose |
| C2 | a node cannot use another project's chapter | rules | member of A and B creates a node in A with a chapter of B; member of A only does the same | refused both times | tests/rules/nodes.rules.test.ts :: a node cannot be placed in another project's chapter |
| C3 | a node cannot move project or chapter | rules | update `project`; update `chapter` (same project) | refused, unchanged | tests/rules/nodes.rules.test.ts :: a node keeps its project and chapter |
| C4 | parallel node edits survive | rules | 5 rounds of parallel `title` and `x`,`y` updates | both kept every round | tests/rules/nodes.rules.test.ts :: parallel edits of a node's title and position both survive |
| C5 | outsiders see no nodes | rules | outsider and anonymous list, view, create, update; filter `' OR 1=1 --` | empty, 404, refused, refused | tests/rules/nodes.rules.test.ts :: outsiders and signed-out callers cannot reach nodes |
| C6 | a line cannot point into another project | rules | line in A on a node of B; update `node` or `project` | refused | tests/rules/script_lines.rules.test.ts :: a script line cannot point into another project |
| C7 | members write and delete lines | rules | create, update `text` with version, delete; outsider delete | 201, 200, 204; outsider refused | tests/rules/script_lines.rules.test.ts :: members write and delete script lines |
| C8 | a deleted line comes back with its id | rules | delete a line, create it again with the same id and fields | 201, same id | tests/rules/script_lines.rules.test.ts :: a deleted line can be re-created with its id |
| C9 | cue types | rules | `type: 'video'`; `type: 'lighting'`; foreign node | refused; 201; refused | tests/rules/cues.rules.test.ts :: cues take only the three types and stay in their project |
| C10 | a connection stays in its project | rules | `to_node` in another project; update `from_node` | refused both | tests/rules/connections.rules.test.ts :: a connection cannot reach into another project |
| C11 | one connection per pair; self-links allowed | rules | same pair twice; `from_node = to_node`; label update with version | second refused; self-link 201; label 200 | tests/rules/connections.rules.test.ts :: two nodes have at most one connection and a node may link to itself |
| C12 | first node becomes the start node | rules | first node; second node; project version before and after | `start_node` = first; unchanged by the second; project version +1 once | tests/rules/projects.rules.test.ts :: the first node becomes the start node |
| C13 | start node stays in its project | rules | set `start_node` to a node of another project; to a node of the same project | refused; 200 | tests/rules/projects.rules.test.ts :: the start node must belong to the project |
| C14 | trash, not delete, for nodes; purge cascades | rules | member API-deletes a node; admin deletes a node with lines, cues, connections that is the start node | refused; children gone and `start_node` empty | tests/rules/nodes.rules.test.ts :: nodes are trashed by members and purged only by the server |
| C15 | an id cannot be reused while it exists | rules | create a line with an id that exists | refused, original untouched | tests/rules/script_lines.rules.test.ts :: an existing id cannot be taken over |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
none (no screen)
### Evidence
The full output of `npm run check:task`, the open-rule run of Step 4, and `findings.md` if Step 3's fallback was needed.
