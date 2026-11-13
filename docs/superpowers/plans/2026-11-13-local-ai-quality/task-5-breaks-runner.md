# Task 5: Deliberate breaks runner

Part of the [Local-AI Quality plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong (it edits source files; a restore bug leaves a developer with a broken file)  
**Depends on:** Task 2 (`BreakRow`, `parseTestPlan`)

**Files:**
- Create: `scripts/lib/breaks.ts`, `scripts/lib/breaks.test.ts`, `scripts/run-breaks.ts`, `scripts/run-breaks.test.ts`
- Modify: `package.json` (`check:breaks`), `docs/developer/test-plan-format.md` (breaks section), `AGENTS.md`

**Interfaces:**
- Consumes: `BreakRow`, `parseTestPlan` from `scripts/lib/test-plan.ts`.
- Produces, `scripts/lib/breaks.ts`:

```ts
export interface BreakDeps {
  read(path: string): string
  write(path: string, content: string): void
  runTests(testPaths: string[]): Promise<boolean>   // true = the tests passed
}
export interface BreakResult { id: string; status: 'caught' | 'survived' | 'invalid'; detail: string }
export function applyBreak(source: string, find: string, replace: string): string | null  // null unless `find` occurs exactly once
export { isBreakablePath } from './test-plan.ts'   // defined and tested in Task 2; re-exported here so callers import one module
export async function runBreaks(breaks: BreakRow[], deps: BreakDeps): Promise<{ baselinePassed: boolean; results: BreakResult[] }>
```

`runBreaks` contract: (1) run the union of all named tests first; if they fail the result is `baselinePassed: false` and no break is applied (a break proves nothing against red tests). (2) For each break: read the file, `applyBreak`; if null or the path is not breakable the status is `invalid` and nothing is written; otherwise write the broken source, run that break's named tests, and **always restore the exact original bytes in a `finally`**, even if `runTests` throws. Tests that still pass = `survived` (a failure of the task); tests that fail = `caught`.

- Produces, `scripts/run-breaks.ts`: `node scripts/run-breaks.ts <task.md>`; `runTests` runs `npx vitest run --project unit <paths>`; prints `B1 caught`, `B2 SURVIVED: the tests did not notice <file>: <find> -> <replace>`, `B3 invalid: <why>`; exit 1 if the baseline failed or any break survived or was invalid; exit 1 for a task with no breaks **when the Test plan has a unit case** (a task with only rules, e2e or manual cases may have none: print "no breaks listed" and exit 0). A SIGINT and SIGTERM handler restores the file in flight before exiting.

**If interrupted:** if this task is killed while a break is applied, run `git status`; a file listed under src/, scripts/ or backend/pb_hooks/lib/ that you did not edit is a left-over break: `git checkout -- <file>` (only if you made no edits to it).

## Checkpoint 5A: the logic

- [ ] **Step 1: Write failing tests** `scripts/lib/breaks.test.ts` (a fake in-memory `BreakDeps`): `applyBreak replaces a single occurrence`; `applyBreak returns null for zero and for two occurrences`; `applyBreak treats find as literal text, not a regular expression ($, ., ( are literal)`; `a replace containing $& is inserted literally`; `runBreaks marks a break on a non-breakable path (tests/x.ts, a hook such as backend/pb_hooks/users-signup.pb.js, ../x.ts) invalid and writes nothing`; `a failing baseline applies no break and writes nothing`; `a caught break restores the file`; `a surviving break is reported and the file is restored`; `runTests throwing still restores the file and rethrows`; `an invalid break (find twice) writes nothing`; `each break runs only its own named tests`; `the restored content is byte-identical (including CRLF and no trailing newline)`; `two breaks on the same file do not compound (the second starts from the original)`.
- [ ] **Step 2: Run** `npx vitest run --project unit scripts/lib/breaks.test.ts`; FAIL. **Step 3: Implement** `scripts/lib/breaks.ts`. **Step 4: Run**; PASS. **Step 5: Close checkpoint 5A** (commit `feat: deliberate breaks logic`).

## Checkpoint 5B: the command

- [ ] **Step 6: Write failing tests** `scripts/run-breaks.test.ts` with a throwaway fixture directory (temp dir with `src/a.ts` exporting `isAdult(age)` using `age >= 18`, `src/a.test.ts` testing 17, 18 and 19 and a vitest config in the temp dir, run via `spawnSync('node', ['scripts/run-breaks.ts', ...])` with `cwd` set to the fixture; allow the command to take `--cwd`): `a break the tests catch exits 0`; `a break the tests miss (tests only try 17 and 19) exits 1 and says SURVIVED`; `after the run the fixture files are unchanged (git diff empty)`; `killing the command with SIGINT mid-run restores the file` (start it, wait for the file to be changed, send SIGINT, assert the original content); `a task with no breaks and a unit case exits 1`; `a task with no breaks and no unit case exits 0`.
- [ ] **Step 7: Run**; FAIL. **Step 8: Implement** the command. **Step 9: Run**; PASS.
- [ ] **Step 10: Show the real thing.** In a scratch copy of one real helper test (`tests/hooks/lockout.unit.test.ts` and `backend/pb_hooks/lib/lockout.js`), write a one-row break and run the command; paste the output (expected `caught`). Then weaken the break so it should survive (change a boundary the tests do not pin) and paste `SURVIVED`. Delete the scratch work.
- [ ] **Step 11: Wire up and verify.** `package.json`, docs, `AGENTS.md`. `npm run lint`, `npm run typecheck`, `npm run test:unit`. Commit `feat: run deliberate breaks`. **Step 12: Close checkpoint 5B.**

## Test plan

Builds the checks. Review Focus 2 is the restore tests (throw, SIGINT, byte-identical, no compounding).
