# Task 4: Guardrail lint rules and the PERF comment check

Part of the [Foundation and Real-Time Spike plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid  
**Depends on:** Task 1

**Files:**
- Create: `tests/lint/guardrails.test.ts`, `scripts/check-perf-comments.ts`, `scripts/check-perf-comments.test.ts`
- Modify: `eslint.config.js`, `package.json` (script `lint`), `docs/engineering.md` (remove "(planned)" from the four rules this task enforces)

**Interfaces:**
- Produces: `npm run lint`; `findBadPerfComments(source: string): number[]`.

**If interrupted** (see the router, "Surviving interruptions"):
- Nothing here leaves state outside the working tree. Follow the router's resume steps.

## Checkpoint 4A: ESLint guardrails

- [x] **Step 1: Write the failing lint tests** in `tests/lint/guardrails.test.ts`. Helper: `ruleIds(code: string, filePath: string): Promise<string[]>` using `new ESLint().lintText(code, { filePath })`.

```ts
// Each test protects one rule in docs/engineering.md section 2 or docs/security.md section 5.
test('pocketbase may not be imported outside src/backend', async () => {
  expect(await ruleIds(`import PocketBase from 'pocketbase'`, 'src/features/canvas/a.ts')).toContain('no-restricted-imports')
  expect(await ruleIds(`import PocketBase from 'pocketbase'\nexport default PocketBase`, 'src/backend/client.ts')).not.toContain('no-restricted-imports')
})
test('dangerouslySetInnerHTML is banned', async () => {
  expect(await ruleIds(`export const A = () => <p dangerouslySetInnerHTML={{ __html: 'x' }} />`, 'src/features/canvas/A.tsx')).toContain('no-restricted-syntax')
})
test('any is banned', async () => {
  expect(await ruleIds(`export const a: any = 1`, 'src/features/canvas/a.ts')).toContain('@typescript-eslint/no-explicit-any')
})
test('files over 300 lines are rejected, 300 is allowed', async () => {
  const lines = (n: number) => Array.from({ length: n }, (_, i) => `export const v${i} = ${i}`).join('\n') + '\n'
  expect(await ruleIds(lines(301), 'src/features/canvas/big.ts')).toContain('max-lines')
  expect(await ruleIds(lines(300), 'src/features/canvas/ok.ts')).not.toContain('max-lines')
})
```

- [x] **Step 2: Run** `npm run test:unit`. Expected: the four new tests FAIL.
- [x] **Step 3: Edit `eslint.config.js`.** Add, for `src/**`: `max-lines: ['error', { max: 300, skipBlankLines: true, skipComments: true }]`; `@typescript-eslint/no-explicit-any: 'error'`; `no-restricted-imports` on path `pocketbase` with message `Only src/backend/ may import pocketbase (docs/engineering.md section 2).`; `no-restricted-syntax` with selector `JSXAttribute[name.name='dangerouslySetInnerHTML']` and message `Plain text only (docs/security.md section 5).`. Turn `no-restricted-imports` off for `src/backend/**`, `tests/rules/**` and `e2e/**`. Ignore `dist/`, `spike/`, `.agents/`, `.claude/`, `branching_narrative_tool.tsx`.
- [x] **Close checkpoint 4A.** Verify: `npx eslint . && npm run test:unit` is clean and shows `5 passed`. Also remove "(planned)" from the `max-lines`, `no-restricted-imports` and strict TypeScript lines in `docs/engineering.md`. Commit: `chore: guardrail lint rules`.

## Checkpoint 4B: PERF comment check

- [x] **Step 4: Write the failing PERF tests** in `scripts/check-perf-comments.test.ts`:

```ts
// Protects docs/engineering.md section 1: a PERF: comment must explain What, Why and Trade-off.
test('complete block comment passes', () => {
  expect(findBadPerfComments('/* PERF: What: a. Why: b. Trade-off: c. */')).toEqual([])
})
test('missing part is reported by line number', () => {
  expect(findBadPerfComments('const a = 1\n// PERF: What: a. Why: b.\nconst b = 2')).toEqual([2])
})
test('consecutive line comments count as one comment', () => {
  expect(findBadPerfComments('// PERF: What: a.\n// Why: b.\n// Trade-off: c.')).toEqual([])
})
test('each PERF comment is judged on its own', () => {
  expect(findBadPerfComments('// PERF: What: a. Why: b. Trade-off: c.\nx()\n// PERF: fast')).toEqual([3])
})
```

- [x] **Step 5: Implement `findBadPerfComments(source: string): number[]`** in `scripts/check-perf-comments.ts`: returns the 1-based line of each `PERF:` whose comment (one block comment, or a run of adjacent `//` lines) lacks any of `What:`, `Why:`, `Trade-off:`. When the file is run directly it checks every `src/**/*.{ts,tsx}`, prints `path:line PERF comment needs What:, Why: and Trade-off:` per problem, and exits 1 if any.
- [x] **Step 6: Script** `lint`: `eslint . && node scripts/check-perf-comments.ts`.
- [x] **Step 7: Run** `npm run lint && npm run test:unit`. Expected: lint clean; `9 passed`.
- [x] **Close checkpoint 4B.** Verify: Step 7 passed, and "(planned)" is removed from the `PERF:` line in `docs/engineering.md`. Commit: `chore: PERF comment check`.
