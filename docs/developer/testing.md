# Testing Guide

This guide documents the test layers, commands, rule test harness, and deny-by-default coverage enforcement in KWNTO.

## Test Layers and Commands

KWNTO uses distinct test projects managed by Vitest and custom test harnesses:

| Layer | Command | Description | Environment |
|---|---|---|---|
| **Unit** | `npm run test:unit` | Pure functions, fast logic, utility tests, script tests | Node.js (Vitest) |
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
- `createUser(options?: { verified?: boolean })`: Creates a test user with a random UUID email (`user-<uuid>@example.test`) and default password `Test-password-1234`. Returns `{ id, email, password }`.
- `asUser(user: TestUser)`: Returns a PocketBase instance authenticated as the given test user.

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

The CI workflow runs on every push and pull request. It uses Node from `.nvmrc` and pins each GitHub Action to its current major version.

| Job | What it runs | Notes |
|---|---|---|
| `checks` | `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm audit --audit-level=high` | Runs on every push/PR |
| `backend` | `npm run test:container`, `npm run test:rules` | Needs Docker + PocketBase service |
| `e2e` | Playwright install (firefox + chromium), `npm run test:e2e` | Uploads `playwright-report/` on failure |
| `secrets` | gitleaks over full history (`fetch-depth: 0`) | Runs on every push/PR |

The first real CI run happens when the developer pushes the branch to GitHub.
