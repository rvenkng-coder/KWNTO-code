# Testing Guide

This guide documents the test layers, commands, rule test harness, and deny-by-default coverage enforcement in KWNTO.

When each layer is required, the test conventions, the catalogue of awkward cases and the definition of done are in the [test strategy](../testing-strategy.md).

## Test Layers and Commands

KWNTO uses distinct test projects managed by Vitest and custom test harnesses:

| Layer | Command | Description | Environment |
|---|---|---|---|
| **Unit** | `npm run test:unit` | Pure functions, fast logic, utility tests, script tests, and the hook helpers in `backend/pb_hooks/lib/` (`tests/hooks/`) | Node.js (Vitest) |
| **Container** | `npm run test:container` | Container hardening, non-root user verification, bootstrap & volume recovery | Docker |
| **Rules** | `npm run test:rules` | PocketBase access rule verification for each collection | PocketBase container via `with-pocketbase.ts` |
| **End-to-end** | `npm run test:e2e` | Full browser flows (Playwright across Chromium & Firefox) | Web app + PocketBase |
| **Full suite** | `npm test` | Runs `lint && typecheck && test:unit && test:container && test:rules && test:e2e` | All |

### Supporting Verification Commands
- `npm run typecheck`: Runs `tsc -b --noEmit` to verify strict TypeScript compiles for `frontend/src/` only (`scripts/`, `tests/` and `e2e/` are not typechecked).
- `npm run lint`: Runs linter guardrails.
- `npm run check:plan`: Checks the Test plan block of every task file in plans that opt in with `**Standard:** test-plan-v1`; format in [test-plan-format.md](test-plan-format.md). Part of `lint`.
- `npm run check:hygiene [-- --base <sha>]`: Test hygiene against the merge base with `main`, on changed test files only (shared changed-files helper: `scripts/lib/changed-files.ts`). Prints `file: rule: detail`, exit 1 on any problem. Reads test files with the TypeScript parser (`scripts/lib/test-ast.ts`, no new dependency): a declaration is a call whose chain starts at `test` or `it`, found in any expression position (conditional, `export default`, comma, template, JSX) and never in strings, comments, regex literals or JSX text. It is backed by raw-text checks (`scripts/lib/test-raw.ts`), so a parser misjudgement can only add false positives; skip and focus words are matched on raw text and a word inside a string or comment is flagged on purpose. Rules, and what each protects:
  - `header`: every added `test(`, `it(`, `test.each(`, `it.each(` has a `//` or `*/` comment on the line directly above (no blank line), so each new test names the risk it protects.
  - `skipped`: `.skip`, `skipIf`, `xit`, `xtest`, `xdescribe`, `test.fixme`, `test.todo` anywhere in a changed test file, so a failing test cannot be switched off.
  - `focused`: `.only`, `fdescribe`, so a run cannot quietly cover a single test.
  - `lost-test`: fewer tests than at base, or a base title now absent (a rename is reported too; the reviewer decides), or a deleted test file, so a removed test cannot hide behind an added one.
  - `lost-assertion`: fewer `expect(` calls than at base, so a test cannot be weakened while it stays green.
  - `scan`: the file has a syntax error (the parser's message and line are shown), so it cannot be read reliably; it is then judged by the raw-text checks alone. Lost tests and assertions are counted on the raw text as well and flagged if either count drops, and a bare test line is looked for on the raw lines too. The header must be a comment (`//`, `/* */` or JSDoc) ending on the line directly above the statement; a statement that does not start its own line (two tests on one line) is a problem.
  - `--base` must be a commit; a value starting with `-` is a usage error (exit 2) and the base is resolved once to a sha.
  - Known limits: a test imported under another name (`import { test as t }`), built with `test.extend`, or reached by computed access (`test[mode]`) is not recognised as a declaration; a title that is not a literal is compared by its source text and by the test count; `test.describe` and similar Playwright calls are treated as declarations and need a comment. An unknown command-line argument is a usage error (exit 2). Scripts run through a symlinked path work (real paths are compared).
- `npm run check:breaks -- <task.md>` (or `node scripts/run-breaks.ts [--cwd <dir>] <task.md>`): Runs the deliberate breaks of one task file; see [test-plan-format.md](test-plan-format.md#running-the-breaks).
- `npm run check:task -- --task <task.md> [--base <sha>] [--built-by local|strong]`: Runs every check a task ends with and prints one verdict; the implementer pastes the full output in its report. See [check-task.md](check-task.md).
- `npm run prepare-local-run -- <plan folder> <task> [<checkpoint>]`: Builds the sandbox, prompt and start command for one local-model checkpoint after checking the server, task and checkout. See [prepare-local-run.md](prepare-local-run.md).
- `npm run ping:model [-- <baseUrl>]`: Asks the local model server (llama-swap, default `http://localhost:9092`) whether it answers and whether the model is loaded; one line, exit 0 if answering, 1 if not. See [local-model-runbook.md](local-model-runbook.md).
- `npm run check:probes -- <folder>`: Runs a task's unseen probes and prints only each failing row and kind; see [test-plan-format.md](test-plan-format.md#running-the-probes).
- `npm run check:quality [-- --base <sha>]`: Function length, complexity, nesting, parameter and console limits on files changed since the base; see [quality-limits.md](quality-limits.md).
- `npm run report:quality`: The same limits over the whole repository, counts only, exit 0; see [quality-limits.md](quality-limits.md).
- `npm run report:escape-rate -- <progress.md>`: Share of local-model tasks that had a problem escape after close; exits 1 on a missing, empty or malformed table. See [review-sampling.md](review-sampling.md).

---

## Backend Rule Testing (`tests/rules/`)

Access rules in PocketBase govern authorization and data visibility. All rule tests execute against a live PocketBase test instance started on `http://127.0.0.1:8091` using temporary storage (`tmpfs`).

### Test Helpers (`tests/rules/helpers/pb.ts`)
The test harness provides authenticated and anonymous PocketBase clients:

- `PB_URL`: Target PocketBase URL (`process.env.KWNTO_PB_URL ?? 'http://127.0.0.1:8091'`).
- `asAnonymous()`: Returns an unauthenticated PocketBase instance.
- `asAdmin()`: Returns a superuser-authenticated PocketBase instance (credentials from `compose.test.yaml`).
- `createUser(options?: { verified?: boolean })`: Creates a test user with a random UUID email (`user-<uuid>@example.test`) and default password `Test-password-1234`. Returns `{ id, email, password }`. It uses the admin API, so the user is **verified by default** and the sign-up rules (closed registration, forced `verified: false`) do not apply. Use it whenever a test needs a ready account, including a verified one.
- `signUp(email, password, extra?)`: Creates a user through the public sign-up, the same door a visitor uses, so the sign-up hook applies: the account is **not verified**, and a closed registration or a weak password refuses it. Returns `{ id }`. Use it only to test sign-up itself.

Rule test files run **one at a time** (`fileParallelism: false` in `vitest.config.ts`), because some tests change global settings (`registration_open`, `security_retention_days`, `max_failed_logins`, `lockdown`) and restore them in `afterEach`. Tests inside a file also run in order. **A test that changes a global setting must restore it in `afterEach`** (not at the end of the test, which a failure would skip), and such tests only work while rule files run serially; never turn `fileParallelism` back on.

Every rule test request comes from one IP (PocketBase sees the Docker gateway), so behaviour that depends on the caller's IP, such as the per-IP lockout, cannot be shown by a rule test. Pin it in the unit test of the pure helper instead and say so in the rule test file (see `users.signin.rules.test.ts`). Lockout tests use a fresh account or email each, so their counts never mix.

Some paths cannot be driven automatically because their token arrives by mail: confirming an email address and confirming a password reset. They are checked by hand (Task 5 runbook walk); see `.planning/2026-11-12-accounts-teams/findings.md` for the probe that checked them.
- `asUser(user: TestUser)`: Returns a PocketBase instance authenticated as the given test user.
- `rawSend(token, path, init?)`: a plain HTTP call to the test backend with the given token, or with none when `token` is `undefined` (a signed-out caller). `init` is `{ method?, body? }`; a body is sent as JSON. Use it for custom routes and to try an old session token after it was ended (`admin-controls.rules.test.ts`).
- `adminSend(path, init?)`: the same call as the admin.

### Teams (`tests/rules/helpers/pb.ts`, `tests/rules/helpers/teams.ts`)
- `createTeam(owner, name?)`: creates a team through the owner's own session (so the create rule and the teams hook apply), then reads the join code as the admin. Returns `{ id, joinCode }`. The owner must be verified (the `createUser()` default).
- `addMember(teamId, user)`: adds a plain member as the admin (joining by code and by invite come in later tasks). Returns the `team_members` row id.
- `teamRows(collection, teamId)` and `memberRow(teamId, userId)`: rows read as the admin.
- `expectCreateRefused(request)`: a refused create is 400 (a create rule that does not match: PocketBase answers "Failed to create record.") or 403 (a locked, `null`, rule).
- `expectNoEmail(response)` and `expectNoEmailOf(response, ...others)`: no `@` anywhere in a team response; or, where a response expands user records (the caller may see their own), none of the given other people's emails.

Rule fragments used by the team collections (in [1794360400_teams.js](../../backend/pb_migrations/1794360400_teams.js)):
- **Verified only:** `@request.auth.verified = true` (teams create, as in Task 3).
- **Caller is a member:** `team_members_via_team.user ?= @request.auth.id` on `teams`, and `team.team_members_via_team.user ?= @request.auth.id` on a table that links to a team. `?=` is "any row matches"; a plain `=` would require every member row to be the caller, and the member tests fail with it.
- **Caller owns the team:** `team.owner = @request.auth.id`.
- **Field may not be written:** `@request.body.<field>:isset = false` (the team's `owner`, the settings' `join_code` and `team`).

Test the outsider, a plain member and a removed member for every team table: a rule that works for the owner can still leak to the others.

**Join by code** (`tests/rules/teams.join.rules.test.ts`, an extra file, not a collection): the custom routes are called with `rawSend` and the caller's token. For a route that must not be an oracle, compare the whole error body of every refused case with the first one, not only the status. The rate-limit tests set `team_attempts_per_hour` low and restore 20 in `afterEach`; every other test uses fresh users, so the per-user limit is never reached by accident. An `invite` attempt is seeded there as an admin-created `security_events` row; the real shared limit, in both directions, is tested in `teams.invites-answer.rules.test.ts`.

**Invites** (`tests/rules/team_invites.rules.test.ts` for the table, with invites seeded as the admin; `teams.invites.rules.test.ts` for sending and `teams.invites-answer.rules.test.ts` for accepting, declining, the shared limit and the log, both extra files). Helpers in `tests/rules/helpers/invites.ts`:
- `invite(owner, teamId, email)`, `accept(user, inviteId)`, `decline(user, inviteId)` and `joinByCode(user, code)` call the routes with the user's token; `send(token, path, init)` is the general form. Each returns a `Reply`: `status`, the parsed `body` (`null` for an empty 204) and `raw`, the headers and body as text, to search for an email.
- `invitesOf(user)` and `onlyInviteOf(user)` (the invites a person received, as the admin), `eventsOf(user, 'invite' | 'join')` (their log entries, oldest first).
- `setAttemptsPerHour(n)` (restore 20 in `afterEach`), `namedUser(name)`, `setName(user, name)`, `unverifiedUser()` (public sign-up, not verified), `setVerified(user, flag)`.

To prove an owner sees no trace of a pending invitee, the test lists every collection the admin knows as the owner and searches the rows for the invitee's id, email and name. `sign-in` log entries hold the email as typed (Task 4), so a check that no email is logged must look at `invite` entries only.

### Content collections (`tests/rules/helpers/content.ts`)
`projects`, `project_settings`, `chapters` and (from Task 6 of the editor core plan) the node tables. Every update goes through the version guard ([backend.md, "Guarded writes"](backend.md#guarded-writes)), so an update must send `version`.

- `createProject(user, teamId, name?)`: creates a project through the member's own session (the create rule and the projects hook apply), then finds its settings row and first chapter as the admin. Returns `{ id, chapterId, settingsId }`.
- `guardedUpdate(user | null, collection, id, body)`: a `PATCH` of one record as the user, or signed out with `null`, with `body` sent exactly as given (leave out `version`, or send a stale one, to test the guard). Never throws on an error status; returns a `Reply` (`status`, `body`, `raw`, from `helpers/invites.ts`).
- `readAsAdmin(collection, id)`: the record as stored, to check that a refused write changed nothing and that `version` rose by exactly 1.

Rule fragments of the content collections (in [1794370000_projects_chapters.js](../../backend/pb_migrations/1794370000_projects_chapters.js); Task 6 copies them): **member of the project's team** `project.team.team_members_via_team.user ?= @request.auth.id`; **create** adds `@request.body.version:isset = false && @request.body.deleted_at:isset = false`; **update** adds `@request.body.version:isset = true` and forbids the parent field (`team` or `project`). An update refused by its rule answers 403 or 404; a stale `version` answers 409. `tests/rules/content-guard.rules.test.ts` holds the concurrency proof (two members, 20 rounds of parallel edits of different fields of one chapter).

### Admin-only collections (`tests/rules/helpers/admin-only.ts`)
Collections only the admin may touch (the `system_*` settings and `security_events`) share one set of checks:

- `adminOnlyTests(collection, change, targetId?)`: a signed-out visitor and a signed-in user cannot list, view, create, update or delete, and an injection string in a filter returns nothing. `change` is a real field edit; `targetId` gives an existing record (by default the collection's only record).
- `singleRecordTest(collection)`: the admin sees exactly one record (settings tables).
- `readOnlyRecord(collection)`: the single record, read as the admin, for checking defaults.
- `expectRefused(request)` and `expectNoRows(pb, collection, filter?)`: a refusal is a 403 or 404; a refused list is a 403 or no rows.

### Per-user tables (`tests/rules/helpers/user-rows.ts`)
Tables with one row per account (`user_preferences`, `user_limits`, `user_status`):

- `rowsOf(collection, userId)` and `onlyRowOf(collection, userId)`: a user's rows, read as the admin; `onlyRowOf` also checks there is exactly one.
- `adminOnlyUserRowTests(collection, change)`: for admin-only per-user tables. A new user gets exactly one row; the user it describes cannot list, view, create, update or delete it (and it is unchanged afterwards); plus `adminOnlyTests` aimed at a real user's row.

### How to Add a Rule Test for a New Collection

1. Create a test file in `tests/rules/` named `<collection>.rules.test.ts` (e.g. `tests/rules/projects.rules.test.ts`).
2. Test every permission boundary (list, view, create, update, delete) for:
   - Signed-out visitors (`asAnonymous()`)
   - Non-owner users (`asUser(otherUser)`)
   - Owner users (`asUser(owner)`)
   - Injection payloads (filter strings must be treated as data)
3. Ensure the test file name matches the collection name exactly (`<collection>.rules.test.ts`), because the live coverage check validates this automatically.

---

## Deny-by-Default and `PUBLIC_RULES`

PocketBase access rules default to `null` (superuser only). Setting a rule to `""` makes it public (accessible by anyone, including anonymous visitors).

To prevent accidental public exposures:
1. `tests/rules/coverage.rules.test.ts` inspects all collections on the live server and verifies that every non-system collection has a corresponding rule test file.
2. Any rule set to `""` is flagged as a failure unless explicitly listed in `PUBLIC_RULES` in `tests/rules/helpers/coverage.ts`.

### Modifying `PUBLIC_RULES`
`PUBLIC_RULES` starts as:
```ts
export const PUBLIC_RULES: readonly string[] = ['users.createRule'] // open sign-up, design 7c
```

**Rule:** Adding any rule to `PUBLIC_RULES` is a recorded security decision. Every entry MUST include a code comment citing the specific design or security specification section authorizing public access.

---

## Hook Helper Tests (`tests/hooks/`)

The pure helpers that PocketBase hooks load from `backend/pb_hooks/lib/` are tested here, one file per helper, named `<helper>.unit.test.ts`. They run in the unit project (`npm run test:unit`), without PocketBase. Load the helper with `createRequire(import.meta.url)`, because it is CommonJS. See [backend.md](backend.md#hooks-and-their-helpers) for the rules these helpers follow.

---

## End-to-End Testing (`e2e/`)

End-to-end tests verify the full stack: browser → Vite dev server → PocketBase proxy. They run as the last layer of `npm test` and in the CI's `e2e` job.

### Configuration (`playwright.config.ts`)
- **Browsers:** Chromium and Firefox (desktop, latest).
- **Base URL:** `http://localhost:5174` (Vite dev server started by Playwright's `webServer`).
- **WebServer:** Starts `npm run dev -- --port 5174 --strictPort` automatically before tests.
- **Timeout:** 60 seconds per test.
- **The performance spec runs alone.** `e2e/editor-performance.spec.ts` (500 nodes within 3 s, [decision 0003](../decisions/0003-canvas-performance.md)) is left out of the `chromium` and `firefox` projects and runs in `perf-chromium`, then `perf-firefox`, after every other test has finished, so no other worker shares the machine with it. It loads a **production build** served by `vite preview` on port 5175 (a second Playwright web server), not the dev server, so it times the app people will use. Next to three other workers it measured load, not the app (Firefox about 1.2 s alone, up to 3.4 s in the parallel suite). If any other test fails, Playwright skips the two perf projects. To run only the performance spec: `npm run test:e2e -- --project perf-firefox --project perf-chromium --no-deps`.

### Running E2E Tests
- **Standalone:** `npm run test:e2e` (starts PocketBase via `with-pocketbase.ts`, then Playwright).
- **Full suite:** `npm test` (includes e2e as the last layer).
- **Safe next to the dev backend.** `compose.test.yaml` sets `name: kwnto-test`, so the harness's `docker compose down -v --remove-orphans` only touches its own container. Without a name, tests and `npm run dev:backend` shared one Compose project and removed each other's container (issue 25). `scripts/compose-names.test.ts` fails if a test compose file loses its name. Leftover web servers on 5174 or 5175 from an interrupted run still stop the next run (`strictPort`); stop them first.

### Writing E2E Tests
1. Create a file in `e2e/` named `<feature>.spec.ts`.
2. Import from `@playwright/test`.
3. Use Playwright's built-in assertions (`expect`) and locators (`getByRole`, `getByTestId`, etc.).
4. Each test should verify a complete user flow, not just a single element.

### Helpers (`e2e/helpers/`)
- `admin.ts`: `verifyByEmail(email)` (marks an account verified, standing in for the email link), `uniqueEmail()`, `userExists(email)`; they sign in as the test admin.
- `ui.ts`: `signUp`, `signUpVerifyAndSignIn`, `createTeam` (fills the Create team dialog), `openTeam` (waits for `data-loaded="true"` on the member list), `enableJoinCode`, `joinWithCode`, `settled` (network idle).
- **Never `waitForTimeout`.** Wait for something on the page. For "X is absent" first wait for a positive signal that the screen has loaded (`openTeam` does; for a list use `settled`), or the check passes before the data arrives. Use `toBeEnabled()` for a gate, not `toBeVisible()`: a disabled button is visible. Wait for each sign-in response when counting attempts (`clickAndWaitForSignIn` in `accounts.spec.ts`).

### If interrupted
A killed Playwright run can leave Vite listening on port `5174`; the next run then fails at once because of `--strictPort`. Find it with `lsof -i :5174` and stop that one process.

### Edge test (`tests/container/edge.test.ts`)

Starts `compose.prod.yaml` with `compose.edge-test.yaml` (Caddy and PocketBase, no Tailscale) and tests the public address: Caddy on `127.0.0.1:8094` (`EDGE_URL`), PocketBase direct on `127.0.0.1:8095` (`EDGE_ADMIN_URL`, set-up calls only; never send an app request to it). It builds `dist/` first if it is missing, and removes the stack with `down -v` afterwards. Helpers are in `tests/container/helpers/edge.ts`. Run it alone with `npx vitest run --project container tests/container/edge.test.ts`. Ports in use across the repo: `8090` dev, `8091` test, `8092` spike, `8093` container test, `8094` and `8095` edge test.

### Backup test (`tests/container/backup.test.ts`)

Starts `compose.prod.yaml` with `compose.backup-test.yaml` (project `kwnto-backup-test`): the same ports as the edge test (`8094`, `8095`), so the two files run one at a time (the container project already does). Data lives in the ordinary named volume `kwnto-data`, which Compose names `kwnto-backup-test_kwnto-data` like on the VM (the restore runs without `KWNTO_DATA_VOLUME`, so it must find the prefixed name itself) and backups in a temporary host folder (`KWNTO_BACKUP_DIR`); both are removed afterwards. It runs `deploy/backup-now.sh` (C1, also checking that the password never shows in `ps`) and `deploy/restore.sh` (C2 to C4: data, media file and admin password come back; a missing or non-zip file is refused; without `--yes` it asks first). Helpers are in `tests/container/helpers/backup.ts`. Run it alone with `npx vitest run --project container tests/container/backup.test.ts`. If a killed run left things behind: `docker compose -f compose.prod.yaml -f compose.backup-test.yaml down -v` and `docker volume rm -f kwnto-backup-test_kwnto-data`.

---

## Pre-commit Hook: Secret Scan

A `.githooks/pre-commit` hook runs [gitleaks](https://github.com/gitleaks/gitleaks) on every commit, scanning only staged changes. If a secret is detected, the commit is blocked.

- **Install gitleaks:** download from <https://github.com/gitleaks/gitleaks/releases> and put it on your `PATH`.
- **Set up the hook:** run `npm run prepare` (or `git config core.hooksPath .githooks`).
- **Bypassing:** never use `git commit --no-verify`. If a commit is refused because gitleaks is not installed, install it — do not bypass.

## Documentation Link Check

`npm run check:docs` scans every git-tracked `*.md` file (outside `.agents/`, `.claude/`, `.planning/`, and `node_modules/`) for broken relative markdown links. It ignores links inside fenced code blocks, external URLs, and `mailto:` links.

- **Add to lint:** `check:docs` is included in the `lint` script.
- **Fix broken links:** resolve relative links to existing files; remove or fix external links that are no longer valid.

## CI Workflow (`.github/workflows/ci.yml`)

The CI workflow runs on pushes to `main` and on every pull request (so a branch with an open PR runs once, not twice). It uses Node from `.nvmrc` and pins each GitHub Action to its current major version.

| Job | What it runs | Notes |
|---|---|---|
| `checks` | `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm audit --omit=dev --audit-level=high` (shipped dependencies only; build and test tools are not audited in CI, developer decision 2026-11-18) | Runs on every run |
| `backend` | `npm run test:container`, `npm run test:rules` | Uses the runner's Docker; `with-pocketbase.ts` starts and stops PocketBase itself |
| `e2e` | Playwright install (firefox + chromium), `npm run test:e2e` | Uses the runner's Docker via `with-pocketbase.ts`; uploads `playwright-report/` on failure |
| `secrets` | gitleaks over full history (`fetch-depth: 0`) | Runs on every run |

