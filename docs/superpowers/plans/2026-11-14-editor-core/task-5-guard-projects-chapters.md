# Task 5: Guarded write, projects, chapters, project settings

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** none

The version-guarded update of [decision 0002](../../../decisions/0002-realtime-spike.md) becomes shared production code (D3), and the first three content collections use it. Read the decision's "What it took to get here" before Step 7: a version check in model hooks loses edits; only a hook on the update **request** that bumps and writes in one transaction is correct.

**Files:**
- Create: `backend/pb_hooks/lib/content-guard.js`, `tests/hooks/content-guard.unit.test.ts`, `backend/pb_migrations/1794370000_projects_chapters.js`, `backend/pb_hooks/content-guard.pb.js`, `backend/pb_hooks/projects.pb.js`, `tests/rules/helpers/content.ts`, `tests/rules/projects.rules.test.ts`, `tests/rules/project_settings.rules.test.ts`, `tests/rules/chapters.rules.test.ts`, `tests/rules/content-guard.rules.test.ts`
- Modify: `docs/superpowers/specs/2026-11-11-kwnto-erd.md` (`version` on the seven collections, `projects.updated`, `chapters.position` decimal, `project_settings` default, team delete cascades projects D13), `docs/developer/backend.md` (section "Guarded writes"), `docs/admin/settings.md` (`project_settings`), `docs/developer/testing.md` (new helpers)

**Interfaces:**
- Produces, `backend/pb_hooks/lib/content-guard.js` (CommonJS):

```js
const GUARDED = ['projects', 'project_settings', 'chapters', 'nodes', 'script_lines', 'cues', 'connections']
guardedTable(name /* string */)            // -> name when it is in GUARDED; otherwise throws Error(`not a guarded collection: ${name}`)
changedFields(fieldNames, read, readOriginal) // (string[], (n) => unknown, (n) => unknown) -> string[]; skips id, version, created, updated; compares JSON.stringify of both values
parseSentVersion(value /* unknown */)      // -> the value when it is an integer >= 0, else null
module.exports = { GUARDED, guardedTable, changedFields, parseSentVersion }
```

- Produces: collections (every one: `version` number, integer, min 0, starts at 0; `created`/`updated` autodate where listed):
  - `projects`: `team` (relation `teams`, required, **cascade delete**, D13), `name` (text 1 to 120), `deleted_at` (date), `version`, `created`, `updated`. (`start_node` is added by Task 6, once `nodes` exists.)
  - `project_settings`: `project` (relation, required, unique, cascade), `analytics_enabled` (bool, default false, D6), `version`.
  - `chapters`: `project` (relation, required, cascade), `title` (text 1 to 120), `position` (number, decimal), `deleted_at` (date), `version`, `created`, `updated`.
- Produces: the rule fragments (constants at the top of the migration; Task 6 copies them):
  - `IS_TEAM_MEMBER_OF_PROJECT = "@request.auth.id != '' && project.team.team_members_via_team.user ?= @request.auth.id"`
  - create: caller is a member of the team (projects) or project (others) **in the body**, `@request.body.version:isset = false`, `@request.body.deleted_at:isset = false`
  - update: member, `@request.body.version:isset = true`, the parent field (`team` or `project`) not set; for `projects`, `deleted_at` may be set only by `team.owner`
  - list and view: member. delete: `null` for all three (trash is an update; purge is Plan 7's server job)
- Produces: creating a project also makes its `project_settings` row and a chapter `Chapter 1` with `position` 1, in one transaction (`projects.pb.js`).
- Produces: the guarded update (`content-guard.pb.js`) for every collection in `GUARDED`: answers **409** `{"message": "This record was changed by someone else. Reload it and try again."}` when the sent `version` is not the stored one; otherwise writes only the changed fields onto the freshly read record, sets `version` to stored + 1 and answers 200 with the saved record.
- Produces, `tests/rules/helpers/content.ts`:

```ts
export async function createProject(user: TestUser, teamId: string, name?: string): Promise<{ id: string; chapterId: string; settingsId: string }>
export async function guardedUpdate(user: TestUser | null, collection: string, id: string, body: Record<string, unknown>): Promise<Reply> // Reply from helpers/invites.ts; body sent as given
export async function readAsAdmin(collection: string, id: string): Promise<Record<string, unknown>>
```

**If interrupted:** nothing leaves state outside the working tree (the test backend is recreated by `with-pocketbase`).

## Checkpoint 5A: The guard's pure parts

- [ ] **Step 1: Write the failing tests** C1 to C4 in `tests/hooks/content-guard.unit.test.ts` (load the module with `createRequire`, as the other `tests/hooks/` files do).
- [ ] **Step 2: Run** `npm run test:unit`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `lib/content-guard.js`.** Write the checks as `if (!GUARDED.includes(name))`, `const SKIP = ['id', 'version', 'created', 'updated']` and `Number.isInteger(value) && value >= 0` (breaks B1 to B3 target these).
- [ ] **Step 4: Run** `npm run test:unit`. Expected: PASS. **Close checkpoint 5A** (commit `feat: content guard helpers`).

## Checkpoint 5B: Three collections, their rules and the guarded update

- [ ] **Step 5: Write the failing rule tests** C5 to C14 in the three collection files and the helpers in `tests/rules/helpers/content.ts`. Each file opens with a header naming design 5 (teams own projects; only the owner deletes a project) and security.md section 2.
- [ ] **Step 6: Run** `npm run test:rules`. Expected: the new files FAIL.
- [ ] **Step 7: Write the migration and the two hooks.** `content-guard.pb.js` follows the spike's `spike/realtime/pb_hooks/version.pb.js`, with three changes: the table name comes from `guardedTable(e.record.collection().name)` (never from the request), the version from `parseSentVersion` (null is 400 `version is required`), and the changed fields from `changedFields`. Register it once with all seven names as tags (collections that do not exist yet are simply never matched). `projects.pb.js` follows `teams.pb.js`: `onRecordCreate` on `projects` opens the transaction, calls `e.next()` inside it and saves the settings row and `Chapter 1`.
- [ ] **Step 8: Confirm the order of checks** in 0.40.6: the update rule must be applied before `onRecordUpdateRequest` runs. C11 and C12 prove it. If they fail because the hook ran first, stop and report: the guard would then have to check access itself, which is a design change.
- [ ] **Step 9: Run** `npm run test:rules`. Expected: PASS. Then open the `chapters` update rule once (`@request.auth.id != ''`), run, see C11 fail, restore (testing-strategy section 2), and say so in the report.
- [ ] **Step 10: Close checkpoint 5B** (commit `feat: projects, chapters and project settings with guarded updates`).

## Checkpoint 5C: Concurrency proof and docs

- [ ] **Step 11: Write** `tests/rules/content-guard.rules.test.ts` (C15, C16). Two members, two SDK sessions, 20 rounds; in each round both send at the same moment (`Promise.all`) an update of a different field of the same chapter (`title` and `position`) with the version both read; the loser gets 409, re-reads, re-applies only its own field and retries (at most 20 times).
- [ ] **Step 12: Run** `npm run test:rules`. Expected: PASS. Run the file 3 more times; expected: PASS each time.
- [ ] **Step 13: Docs.** ERD changes listed under **Files**; `docs/developer/backend.md` "Guarded writes" (what the client sends, the 409 answer, why the hook is on the request, how to add a collection to `GUARDED`); `project_settings` in `docs/admin/settings.md`; helpers in `docs/developer/testing.md`. **Close checkpoint 5C** (commit `test: concurrent edits keep both fields`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | only the seven collections are guarded | unit | `guardedTable('nodes')`; `'users'`; `"nodes; DROP TABLE x"` | `'nodes'`; throws; throws | tests/hooks/content-guard.unit.test.ts :: guardedTable accepts only the content collections |
| C2 | changed fields | unit | title changed, x unchanged, version changed | `['title']` | tests/hooks/content-guard.unit.test.ts :: changedFields lists only the fields that differ |
| C3 | version and timestamps are never changed fields | unit | only `version`, `updated` differ | `[]` | tests/hooks/content-guard.unit.test.ts :: version and timestamps are never changed fields |
| C4 | sent version parsing | unit | `0`, `7`, `-1`, `1.5`, `'3'`, `null`, `undefined`, `NaN` | `0`, `7`, then `null` for the rest | tests/hooks/content-guard.unit.test.ts :: parseSentVersion accepts only whole numbers from 0 |
| C5 | a member creates a project with settings and a first chapter | rules | member creates `Story` in their team | 201; one `project_settings` row (`analytics_enabled` false) and one chapter `Chapter 1` at position 1 | tests/rules/projects.rules.test.ts :: a member creates a project with its settings and first chapter |
| C6 | outsiders and signed-out callers see nothing | rules | list, view, create as outsider and anonymous; filter `' OR 1=1 --` | empty lists, 404 views, refused creates | tests/rules/projects.rules.test.ts :: outsiders and signed-out callers cannot reach a project |
| C7 | only the owner trashes a project | rules | member sets `deleted_at`; owner does | member refused, owner 200 | tests/rules/projects.rules.test.ts :: only the team owner moves a project to the trash |
| C8 | a project cannot move team | rules | update `team` to the caller's other team | refused, team unchanged | tests/rules/projects.rules.test.ts :: a project cannot be moved to another team |
| C9 | deleting the team removes its projects | rules | owner deletes the team | project, settings and chapters gone | tests/rules/projects.rules.test.ts :: deleting a team removes its projects |
| C10 | settings: members edit, nobody creates or deletes | rules | member toggles `analytics_enabled`; create; delete; outsider update | 200; refused; refused; refused | tests/rules/project_settings.rules.test.ts :: members edit project settings and nobody creates or deletes them |
| C11 | the guard is not a back door | rules | outsider and anonymous update a chapter with its current version | refused (403 or 404); record and version unchanged | tests/rules/chapters.rules.test.ts :: the guarded update still refuses outsiders |
| C12 | version rules | rules | update without `version`; with an old one; with stored + 5; create with `version: 9` | refused; 409 and unchanged; 409; refused | tests/rules/chapters.rules.test.ts :: an update needs the current version and create cannot set one |
| C13 | a chapter cannot move project | rules | member of two projects updates `project` | refused | tests/rules/chapters.rules.test.ts :: a chapter cannot be moved to another project |
| C14 | members manage chapters; delete is trash | rules | member creates, renames, sets `deleted_at`; API delete | 201, 200 (version +1), 200; delete refused | tests/rules/chapters.rules.test.ts :: members create, rename and trash chapters |
| C15 | concurrent different-field edits are both kept | rules | 20 rounds of parallel `title` and `position` updates | both values kept every round; version +2 per round; exactly one 409 per round | tests/rules/content-guard.rules.test.ts :: parallel edits of different fields both survive |
| C16 | a 409 never half-writes | rules | stale update of `title` and `position` together | 409; neither field changed; version unchanged | tests/rules/content-guard.rules.test.ts :: a refused update changes nothing |
### Probes
**Probe folder:** `tests/probes/2026-11-14-editor-core/task-5/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | backend/pb_hooks/lib/content-guard.js | `if (!GUARDED.includes(name))` | `if (false)` | tests/hooks/content-guard.unit.test.ts |
| B2 | backend/pb_hooks/lib/content-guard.js | `const SKIP = ['id', 'version', 'created', 'updated']` | `const SKIP = ['id', 'created', 'updated']` | tests/hooks/content-guard.unit.test.ts |
| B3 | backend/pb_hooks/lib/content-guard.js | `Number.isInteger(value) && value >= 0` | `value >= 0` | tests/hooks/content-guard.unit.test.ts |
### Flow
none (no screen; the rule tests drive the API as each kind of caller)
### Evidence
The full output of `npm run check:task`, the failing run of each break, the open-rule run of Step 9, and the four runs of `content-guard.rules.test.ts` from Step 12.
