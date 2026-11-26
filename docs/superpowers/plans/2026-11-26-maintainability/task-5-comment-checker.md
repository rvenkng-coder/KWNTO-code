# Task 5: A checker for history references and comment-only changes

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** 4

**Files:**
- Create: `scripts/lib/comment-refs.ts`, `scripts/lib/comment-refs.test.ts`, `scripts/check-comment-refs.ts`
- Modify: `package.json`, `docs/developer/lint.md`

**Interfaces:**
- Produces: `export interface CommentRef { line: number; match: string }`
- Produces: `export function findHistoryRefs(path: string, source: string): CommentRef[]`
- Produces: `export function codeWithoutComments(path: string, source: string): string`
- Produces: `npm run check:comments [-- <path>...]` (lists `file:line: match`, exit 1 if any) and `npm run check:comments -- --same-code <base>` (lists changed files whose code differs, exit 1 if any)

**If interrupted:** nothing leaves state outside the working tree.

- [ ] **Step 1: Write the failing tests**, each with a `// Protects:` line:

```ts
const found = (source: string) => findHistoryRefs('a.ts', source).map((r) => r.match)

test('a plan, task, decision, case or finding reference in a comment is reported', () => {
  const source = ['// plan Task 8', '/* D12 and (C4) */', 'const a = 1 // finding B', '// Review Focus 3', '// offline sync plan, M10'].join('\n')
  expect(found(source)).toEqual(['Task 8', 'D12', 'C4', 'finding B', 'Review Focus', 'offline sync plan', 'M10'])
})

test('design references and text outside comments are allowed', () => {
  expect(found("// The newer save wins (design 6.7, decision 0002).\nconst t = 'Task 8 D12'")).toEqual([])
})

test('a comment-only change leaves the code the same', () => {
  const before = '// old\nexport const a = 1\nexport const B = () => <div>{/* old */}</div>'
  const after = '// new reason\n// second line\nexport const a = 1\nexport const B = () => <div></div>'
  expect(codeWithoutComments('a.tsx', after)).toBe(codeWithoutComments('a.tsx', before))
})

test('a code change is not the same code', () => {
  expect(codeWithoutComments('a.ts', 'const a = 2')).not.toBe(codeWithoutComments('a.ts', 'const a = 1'))
})
```

- [ ] **Step 2: Run** `npx vitest run --project unit scripts/lib/comment-refs.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** with the TypeScript parser (`typescript` is already installed). Search only comment ranges, reporting matches in file order, with these patterns:

```ts
const PATTERNS = [
  /\b[Pp]lan (?:\d+[a-z]?\b|\d{4}-\d{2}-\d{2}[\w-]*)/,
  /\b(?:offline sync|editor core|editor cards|node links|media upload|sharing|deployment|export) plan\b/,
  /\bTask \d+/,
  /\bD\d{1,2}\b/,
  /\bfindings? [A-Z0-9]\b/,
  /\bC\d{1,2}\b/,
  /\bM\d{1,2}\b/,
  /Review Focus/,
]
```

  `codeWithoutComments` prints the parsed file with `ts.createPrinter({ removeComments: true })` after dropping empty JSX expressions.
- [ ] **Step 4: Write the command:** files from `git ls-files` under `frontend/src`, `backend/pb_hooks`, `e2e`, `tests`, `scripts` (`.ts`, `.tsx`, `.js`), never `tests/probes` or `backend/pb_migrations`. `--same-code <base>` compares each changed file with `git show <base>:<path>`; an added or deleted file counts as different.
- [ ] **Step 5: Run** the tests (PASS), then `npm run check:comments`. Expected: exit 1, several hundred matches. Record the count per area in `progress.md`. Do not add it to `lint` yet.
- [ ] **Step 6: Document both commands** in `lint.md` and commit `feat: check comments for history references`.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | references found | unit | each kind in a comment | listed in order | scripts/lib/comment-refs.test.ts :: a plan, task, decision, case or finding reference in a comment is reported |
| C2 | living docs and strings allowed | unit | design reference; text in a string | nothing | scripts/lib/comment-refs.test.ts :: design references and text outside comments are allowed |
| C3 | comment-only change | unit | rewritten comments | same code | scripts/lib/comment-refs.test.ts :: a comment-only change leaves the code the same |
| C4 | code change | unit | `1` to `2` | different | scripts/lib/comment-refs.test.ts :: a code change is not the same code |
### Probes
**Probe folder:** none
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | scripts/lib/comment-refs.ts | `\bTask \d+` | `\bTaskX \d+` | scripts/lib/comment-refs.test.ts |
| B2 | scripts/lib/comment-refs.ts | `removeComments: true` | `removeComments: false` | scripts/lib/comment-refs.test.ts |
### Flow
none
### Evidence
The failing run, the counts per area and the `check:task` output.
