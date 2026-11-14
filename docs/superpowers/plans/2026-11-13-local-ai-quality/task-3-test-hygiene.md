# Task 3: Test hygiene check

Part of the [Local-AI Quality plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid  
**Depends on:** none

**Files:**
- Create: `scripts/lib/changed-files.ts`, `scripts/lib/changed-files.test.ts`, `scripts/check-test-hygiene.ts`, `scripts/check-test-hygiene.test.ts`
- Modify: `package.json` (`check:hygiene`), `docs/developer/testing.md`, `AGENTS.md` (Commands table)

**Interfaces:**
- Produces, `scripts/lib/changed-files.ts` (shared by Tasks 3, 4 and 8):

```ts
export interface Change { path: string; status: 'added' | 'modified' | 'deleted' | 'renamed'; oldPath?: string }
export function parseNameStatus(output: string): Change[]            // pure: parses `git diff --name-status -M <base>` output
export function changedFiles(base: string, cwd?: string): Change[]   // committed + staged + unstaged + untracked, relative to base
export function addedLines(base: string, path: string, cwd?: string): Set<number>  // line numbers added in the working copy of path
export function fileAtBase(base: string, path: string, cwd?: string): string | null // null if absent at base
```

- Produces, `scripts/check-test-hygiene.ts`:

```ts
export interface HygieneProblem { file: string; rule: 'header' | 'skipped' | 'focused' | 'lost-test' | 'lost-assertion'; detail: string }
export function isTestFile(path: string): boolean   // *.test.ts, *.test.tsx, *.spec.ts, under any folder
export function checkSource(path: string, source: string, added: Set<number> | null): HygieneProblem[] // header, skipped, focused; added=null means check every test
export function compareWithBase(path: string, baseSource: string, headSource: string): HygieneProblem[] // lost-test, lost-assertion
export function checkHygiene(base: string, cwd?: string): HygieneProblem[]
```

Command: `node scripts/check-test-hygiene.ts [--base <sha>]` (default base `git merge-base HEAD main`); prints each problem as `file: rule: detail`; exit 1 on any problem, 0 with "check:hygiene: ok".

Rules (**[my call]** where the design leaves detail): **header:** every *added* `test(`, `it(`, `test.each(`, `it.each(` line has a comment line (`//` or the end of a `/* */`) directly above it (blank lines between are not allowed). **skipped:** `.skip`, `xit`, `xtest`, `xdescribe`, `test.fixme`, `test.todo` anywhere in a changed test file. **focused:** `.only` or `fdescribe`. **lost-test:** the count of test declarations in a file that exists at base is lower at head, or a test title present at base is absent at head (a renamed title is reported too: say so, the reviewer decides). **lost-assertion:** the count of `expect(` calls in a file that exists at base is lower at head. A deleted test file is a `lost-test` for each test in it.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 3A: changed files

- [x] **Step 1: Write failing tests** `scripts/lib/changed-files.test.ts`: `parseNameStatus reads A M D and R100 lines`; `a rename keeps oldPath`; `paths with spaces are kept` (the repo path itself contains spaces; use tab-separated `-z` output or tab splitting, not whitespace splitting); `empty output gives no changes`; and against a real throwaway repo in a temp dir (`git init`, commits): `changedFiles sees a committed change, a staged change, an unstaged change and an untracked file`; `a deleted file is reported as deleted`; `addedLines gives the line numbers of added lines only`; `fileAtBase returns null for a file that is new`.
- [x] **Step 2: Run** `npx vitest run --project unit scripts/lib/changed-files.test.ts`; FAIL. **Step 3: Implement** with `spawnSync('git', [...])` (no shell), `-M` for renames, `git ls-files --others --exclude-standard` for untracked, `git diff -U0` for added lines. **Step 4: Run**; PASS. **Step 5: Close checkpoint 3A** (commit `feat: changed-files helper`).

## Checkpoint 3B: the hygiene check

- [x] **Step 6: Write failing tests** `scripts/check-test-hygiene.test.ts`, one test per rule with the failing input and the passing input: `a new test with a comment above passes`; `a new test with no comment above fails header`; `a comment separated by a blank line fails header`; `an old test without a comment is not reported when only another test is added`; `it.skip, xit, xtest, test.fixme, describe.skip, test.todo each fail skipped`; `.only and fdescribe fail focused`; `removing a test and adding another still fails lost-test`; `renaming a test title is reported`; `removing an expect( fails lost-assertion`; `adding tests and assertions passes`; `a deleted test file fails lost-test`; `a non-test file is ignored`; `a skip hidden in a string or a comment is still flagged conservatively` (document this as the chosen behaviour: false positives are acceptable, false negatives are not); `isTestFile covers .test.ts, .test.tsx, .spec.ts and nested paths`.
- [x] **Step 7: Run**; FAIL. **Step 8: Implement** the rules with line-based scanning. **Step 9: Run**; PASS.
- [x] **Step 10: Try it on this repo.** Make a scratch commit on a throwaway branch that adds a test without a header and one `it.skip`, run `node scripts/check-test-hygiene.ts --base <the commit before>` and see both reported; delete the branch. Paste the output in the report. Then run it on a clean tree; expected `check:hygiene: ok`.
- [x] **Step 11: Wire up.** `package.json` `check:hygiene`; documentation in `docs/developer/testing.md` (what each rule protects, in one line each) and the `AGENTS.md` Commands table. **Step 12: Verify** `npm run lint`, `npm run typecheck`, `npm run test:unit`. Commit `feat: test hygiene check`. **Step 13: Close checkpoint 3B.**

## Test plan

This task builds the checks, so it cannot use the block. Review Focus 1 and 5 are the tests `removing a test and adding another still fails lost-test`, the skip and focus variants, and the `changedFiles` untracked and deleted cases.
