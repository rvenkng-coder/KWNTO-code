# Testing Guide

This guide documents the test layers, commands, rule test harness, and deny-by-default coverage enforcement in KWNTO.

## Test Layers and Commands

KWNTO uses distinct test projects managed by Vitest and custom test harnesses:

| Layer | Command | Description | Environment |
|---|---|---|---|
| **Unit** | `npm run test:unit` | Pure functions, fast logic, utility tests, script tests, and the hook helpers in `backend/pb_hooks/lib/` (`tests/hooks/`) | Node.js (Vitest) |
| **Container** | `npm run test:container` | Container hardening, non-root user verification, bootstrap & volume recovery | Docker |
| **Rules** | `npm run test:rules` | PocketBase access rule verification for each collection | PocketBase container via `with-pocketbase.ts` |
| **End-to-end** | `npm run test:e2e` | Full browser flows (Playwright across Chromium & Firefox) | Web app + PocketBase |
| **Full suite** | `npm test` | Runs `lint && typecheck && test:unit && test:container && test:rules` | All |

### Supporting Verification Commands
- `npm run typecheck`: Runs `tsc -b --noEmit` to verify strict TypeScript adherence.
- `npm run lint`: Runs linter guardrails.

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

**Join by code** (`tests/rules/teams.join.rules.test.ts`, an extra file, not a collection): the custom routes are called with `rawSend` and the caller's token. For a route that must not be an oracle, compare the whole error body of every refused case with the first one, not only the status. The rate-limit tests set `team_attempts_per_hour` low and restore 20 in `afterEach`; every other test uses fresh users, so the per-user limit is never reached by accident. An `invite` attempt is seeded as an admin-created `security_events` row, since invites arrive in Task 8.

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

End-to-end tests verify the full stack: browser → Vite dev server → PocketBase proxy. They run on every commit via `npm test`.

### Configuration (`playwright.config.ts`)
- **Browsers:** Chromium and Firefox (desktop, latest).
- **Base URL:** `http://localhost:5174` (Vite dev server started by Playwright's `webServer`).
- **WebServer:** Starts `npm run dev -- --port 5174 --strictPort` automatically before tests.
- **Timeout:** 60 seconds per test.

### Running E2E Tests
- **Standalone:** `npm run test:e2e` (starts PocketBase via `with-pocketbase.ts`, then Playwright).
- **Full suite:** `npm test` (includes e2e as the last layer).

### Writing E2E Tests
1. Create a file in `e2e/` named `<feature>.spec.ts`.
2. Import from `@playwright/test`.
3. Use Playwright's built-in assertions (`expect`) and locators (`getByRole`, `getByTestId`, etc.).
4. Each test should verify a complete user flow, not just a single element.

### If interrupted
A killed Playwright run can leave Vite listening on port `5174`; the next run then fails at once because of `--strictPort`. Find it with `lsof -i :5174` and stop that one process.

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
| `checks` | `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm audit --audit-level=high` | Runs on every run |
| `backend` | `npm run test:container`, `npm run test:rules` | Uses the runner's Docker; `with-pocketbase.ts` starts and stops PocketBase itself |
| `e2e` | Playwright install (firefox + chromium), `npm run test:e2e` | Uses the runner's Docker via `with-pocketbase.ts`; uploads `playwright-report/` on failure |
| `secrets` | gitleaks over full history (`fetch-depth: 0`) | Runs on every run |

The first real CI run happens when the developer pushes the branch to GitHub.
