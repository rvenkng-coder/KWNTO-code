# Task 7: Docs check, secret scan and the GitHub workflow

Part of the [Foundation and Real-Time Spike plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid  
**Depends on:** Task 4 and Task 6

**Files:**
- Create: `scripts/check-doc-links.ts`, `scripts/check-doc-links.test.ts`, `.githooks/pre-commit`, `.github/workflows/ci.yml`, `.github/pull_request_template.md`
- Modify: `package.json`, `docs/developer/testing.md`, `docs/engineering.md` (remove "(planned)" from the workflow and checklist lines)

**Interfaces:**
- Produces: `findBrokenLinks(markdown: string, fileDir: string, exists: (absolutePath: string) => boolean): string[]`; npm script `check:docs`.

**If interrupted** (see the router, "Surviving interruptions"):
- **Check first:** if `scratch-fake-secret.txt` exists or is staged, Step 5b was cut short. Unstage it and remove it before anything else. It was created by this plan, so no permission is needed for that one file.
- From 7B on, every commit runs gitleaks. If a commit is refused because gitleaks is not installed, install it (see `docs/developer/testing.md`); do not bypass the hook with `--no-verify`.

## Checkpoint 7A: Markdown link check

- [ ] **Step 1: Write the failing tests** in `scripts/check-doc-links.test.ts`:

```ts
// Protects design 8b.7: markdown links in the docs must resolve.
const exists = (p: string) => ['/r/docs/a.md', '/r/docs/my file.md'].includes(p)
test('existing relative link passes, missing one is reported', () => {
  expect(findBrokenLinks('[a](a.md) [b](b.md)', '/r/docs', exists)).toEqual(['b.md'])
})
test('anchors are ignored when checking the file', () => {
  expect(findBrokenLinks('[a](a.md#part) [top](#here)', '/r/docs', exists)).toEqual([])
})
test('external and mail links are skipped', () => {
  expect(findBrokenLinks('[x](https://example.com) [m](mailto:a@example.com)', '/r/docs', exists)).toEqual([])
})
test('encoded spaces are decoded', () => {
  expect(findBrokenLinks('[f](my%20file.md)', '/r/docs', exists)).toEqual([])
})
test('links inside fenced code blocks are ignored', () => {
  expect(findBrokenLinks('```\n[b](b.md)\n```', '/r/docs', exists)).toEqual([])
})
```

- [ ] **Step 2: Run** `npm run test:unit`. Expected: 5 new tests FAIL.
- [ ] **Step 3: Implement `findBrokenLinks`.** Run directly, the script checks every git-tracked `*.md` outside `.agents/`, `.claude/` and `node_modules/`, prints `file: broken link <target>` per problem and exits 1 if any. Script `check:docs`: `node scripts/check-doc-links.ts`; add it to `lint`.
- [ ] **Step 4: Run** `npm run test:unit && npm run check:docs`. Expected: PASS and no broken links.
- [ ] **Close checkpoint 7A.** Verify: Step 4 passed. Commit: `chore: markdown link check`.

## Checkpoint 7B: Secret scan before each commit

- [ ] **Step 5: `.githooks/pre-commit`:** runs gitleaks on staged changes (check `gitleaks --help` for the current staged-scan command) and blocks the commit on a finding. If gitleaks is not installed it prints the install link and exits 1. Add `"prepare": "git config core.hooksPath .githooks"` to `package.json`.
- [ ] **Step 5b: Prove the hook blocks a secret.** Create `scratch-fake-secret.txt` containing an AWS-style key, `git add` it, and try to commit: the hook must refuse. Then `git restore --staged scratch-fake-secret.txt` and remove that one file. Do this step in one go; it is the only step that puts a fake secret in the index.
- [ ] **Close checkpoint 7B.** Verify: `git status --short` does not list `scratch-fake-secret.txt`, and the hook let this commit through. Commit: `chore: gitleaks pre-commit hook`.

## Checkpoint 7C: Workflow and pull-request checklist

- [ ] **Step 6: `.github/pull_request_template.md`** with this checklist: tests added or updated and passing; docs in `docs/` updated for every feature, setting or script changed; changes to existing code explained (engineering.md section 3); no new dependency without a decision record; `PERF:` comments have What, Why, Trade-off.
- [ ] **Step 7: `.github/workflows/ci.yml`**, on every push and pull request, Node from `.nvmrc`, `npm ci`, with `permissions: contents: read`. Pin each action to the current major version.

| Job | Runs |
|---|---|
| `checks` | `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm audit --audit-level=high` |
| `backend` | `npm run test:container`, `npm run test:rules` |
| `e2e` | `npx playwright install --with-deps firefox chromium`, `npm run test:e2e`; uploads `playwright-report/` on failure |
| `secrets` | gitleaks over the full history (checkout with `fetch-depth: 0`) |

- [ ] **Step 8: Verify locally** what can be verified without pushing: `npm test` and `npm audit --audit-level=high` (the audit needs the internet; if offline, note in `progress.md` that it is still to run). The workflow's first real run happens when the developer pushes; say so in `progress.md` and in the task report. **Do not push.**
- [ ] **Step 9: Document** the hook, `check:docs` and the workflow jobs in `docs/developer/testing.md`.
- [ ] **Close checkpoint 7C.** Verify: Step 8 passed and `npm run check:docs` is clean. Commit: `ci: workflow and pull-request checklist`.
