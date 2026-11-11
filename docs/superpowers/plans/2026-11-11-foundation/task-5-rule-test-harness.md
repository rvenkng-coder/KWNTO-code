# Task 5: Backend rule-test harness and deny-by-default check

Part of the [Foundation and Real-Time Spike plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong  
**Depends on:** Task 2

**Files:**
- Create: `scripts/with-pocketbase.ts`, `tests/rules/global-setup.ts`, `tests/rules/helpers/pb.ts`, `tests/rules/helpers/coverage.ts`, `tests/rules/helpers/coverage.unit.test.ts`, `tests/rules/coverage.rules.test.ts`, `tests/rules/users.rules.test.ts`, `docs/developer/testing.md`
- Modify: `vitest.config.ts` (add `tests/rules/**/*.unit.test.ts` to `unit`, exclude it from `rules`), `tests/container/container.test.ts`, `package.json`

**Interfaces:**
- Consumes: `compose.test.yaml` from Task 2.
- Produces, from `tests/rules/helpers/pb.ts` (every later plan's rule tests use these):

```ts
export const PB_URL: string                       // process.env.KWNTO_PB_URL ?? 'http://127.0.0.1:8091'
export type TestUser = { id: string; email: string; password: string }
export function asAnonymous(): PocketBase
export function asAdmin(): Promise<PocketBase>     // superuser from compose.test.yaml
export function createUser(options?: { verified?: boolean }): Promise<TestUser>  // unique email user-<uuid>@example.test, verified defaults to true
export function asUser(user: TestUser): Promise<PocketBase>
```

- From `tests/rules/helpers/coverage.ts`:

```ts
export type CollectionRules = { name: string; system: boolean; listRule: string | null; viewRule: string | null; createRule?: string | null; updateRule?: string | null; deleteRule?: string | null }
export const PUBLIC_RULES: readonly string[]       // starts as ['users.createRule'] (open sign-up, design 7c)
export function findCoverageProblems(collections: CollectionRules[], testFileNames: string[], publicRules: readonly string[]): string[]
```

- `node scripts/with-pocketbase.ts <command...>`; npm scripts `test:rules`, `test`.

**If interrupted** (see the router, "Surviving interruptions"):
- A killed run can leave the test container up. `scripts/with-pocketbase.ts` removes it at the start of the next run; before that script exists, use `docker compose -f compose.test.yaml down -v`.
- Test users are created in tmpfs data and vanish with the container. Nothing needs cleaning up by hand.

## Checkpoint 5A: Coverage checker (pure function)

- [x] **Step 1: Write the failing unit tests** in `coverage.unit.test.ts`:

```ts
// Protects docs/security.md section 2: "A test fails if any collection has no tested rule",
// and deny by default: a public rule must be a recorded decision, never an accident.
const locked = { system: false, listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }
test('collection without a test file is reported', () => {
  expect(findCoverageProblems([{ ...locked, name: 'nodes' }], [], [])).toEqual(['nodes: no rule test file (expected tests/rules/nodes.rules.test.ts)'])
})
test('public rule not on the allowlist is reported', () => {
  expect(findCoverageProblems([{ ...locked, name: 'nodes', listRule: '' }], ['nodes.rules.test.ts'], [])).toEqual(['nodes.listRule is public ("") and not in PUBLIC_RULES'])
})
test('allowlisted public rule and locked rules pass', () => {
  expect(findCoverageProblems([{ ...locked, name: 'users', createRule: '' }], ['users.rules.test.ts'], ['users.createRule'])).toEqual([])
})
test('system collections are skipped; view collections (no write rules) are still checked', () => {
  expect(findCoverageProblems([{ ...locked, name: '_superusers', system: true, listRule: '' }], [], [])).toEqual([])
  expect(findCoverageProblems([{ name: 'stats', system: false, listRule: '', viewRule: null }], ['stats.rules.test.ts'], [])).toEqual(['stats.listRule is public ("") and not in PUBLIC_RULES'])
})
```

- [x] **Step 2: Run** `npm run test:unit`. Expected: 4 new tests FAIL (`findCoverageProblems` not defined).
- [x] **Step 3: Implement `tests/rules/helpers/coverage.ts`** to the signatures above. Run `npm run test:unit`. Expected: PASS.
- [x] **Close checkpoint 5A.** Verify: `npm run test:unit` passes with the 4 new tests. Commit: `test: deny-by-default coverage checker`.

## Checkpoint 5B: Start and stop PocketBase around a command

- [ ] **Step 4: Implement `scripts/with-pocketbase.ts`:** run `docker compose -f compose.test.yaml down -v --remove-orphans` (clears a stale container from a crashed run), then `up -d --build --wait`, then the given command with inherited stdio and `KWNTO_PB_URL=http://127.0.0.1:8091`, then `down -v` in a `finally`, then exit with the command's exit code.
- [ ] **Step 5: Add a container test** to `tests/container/container.test.ts`:

```ts
// Protects: a failing test run must fail the build, and must not leave a container behind.
test('with-pocketbase passes on the exit code and cleans up', () => {
  const run = spawnSync('node', ['scripts/with-pocketbase.ts', 'node', '-e', 'process.exit(3)'])
  expect(run.status).toBe(3)
  const left = execFileSync('docker', ['compose', '-f', 'compose.test.yaml', 'ps', '-q'], { encoding: 'utf8' }).trim()
  expect(left).toBe('')
})
```

- [ ] **Step 6: Implement `tests/rules/global-setup.ts`:** poll `${PB_URL}/api/health` every 500 ms for up to 30 s; on timeout throw `PocketBase is not reachable at <PB_URL>. Use "npm run test:rules", which starts it.` so a run without the backend fails once, clearly.
- [ ] **Close checkpoint 5B.** Verify: `npm run test:container` shows `4 passed`. Commit: `test: with-pocketbase runner and reachability check`.

## Checkpoint 5C: User helpers and the first rule tests

- [ ] **Step 7: Implement `tests/rules/helpers/pb.ts`** to the signatures above. `createUser` creates through `asAdmin()` with password `Test-password-1234`.
- [ ] **Step 8: Write `tests/rules/users.rules.test.ts`:**

```ts
// Protects docs/security.md section 1.3: emails and accounts are private to everyone but the admin.
test('signed-out visitors cannot list users', async () => {
  await createUser()
  expect((await asAnonymous().collection('users').getList(1, 10)).totalItems).toBe(0)
})
test('a user cannot view another user or see their email', async () => {
  const [a, b] = [await createUser(), await createUser()]
  const pb = await asUser(a)
  await expect(pb.collection('users').getOne(b.id)).rejects.toMatchObject({ status: 404 })
  const listed = await pb.collection('users').getFullList()
  expect(listed.map((u) => u.id)).toEqual([a.id])
  expect(JSON.stringify(listed)).not.toContain(b.email)
})
// Injection strings must be treated as data (docs/security.md section 5).
test('an injection string in a filter returns nothing and does not error out the server', async () => {
  const pb = await asUser(await createUser())
  const result = await pb.collection('users').getList(1, 10, { filter: pb.filter('name = {:n}', { n: `' OR 1=1 --` }) })
  expect(result.totalItems).toBe(0)
})
```

- [ ] **Step 9: Write `tests/rules/coverage.rules.test.ts`:** fetch all collections with `asAdmin()`, list file names in `tests/rules/` ending `.rules.test.ts`, and `expect(findCoverageProblems(collections, files, PUBLIC_RULES)).toEqual([])`. Title: `every collection has a rule test and no unplanned public rule`.
- [ ] **Step 10: Scripts.** `test:rules`: `node scripts/with-pocketbase.ts vitest run --project rules`. `test`: `npm run lint && npm run typecheck && npm run test:unit && npm run test:container && npm run test:rules` (Task 6 appends `test:e2e`).
- [ ] **Step 11: Run** `npm run test:rules`. Expected: `4 passed`. If the `users` tests fail because PocketBase v0.40.6's default `users` rules differ from "a user sees only themself", do not loosen the tests: add a migration `backend/pb_migrations/1794355400_users_rules.js` that sets `listRule` and `viewRule` to `id = @request.auth.id`.
- [ ] **Close checkpoint 5C.** Verify: Step 11 passed (`4 passed` for rules). Commit: `test: users rule tests and live coverage check`.

## Checkpoint 5D: Document the test layers

- [ ] **Step 12: Write `docs/developer/testing.md`:** the test layers, the command for each, how to add a rule test for a new collection, what `PUBLIC_RULES` is and that adding to it needs a design reference in a comment.
- [ ] **Close checkpoint 5D.** Verify: `docs/developer/testing.md` names a command for every layer that exists. Commit: `docs: testing guide`.
