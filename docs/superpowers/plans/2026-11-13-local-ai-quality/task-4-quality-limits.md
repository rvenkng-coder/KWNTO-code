# Task 4: Code quality limits on changed files

Part of the [Local-AI Quality plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid  
**Depends on:** none (uses `scripts/lib/changed-files.ts` from Task 3 if it exists; if Task 4 runs first, build that helper here per Task 3's Interfaces and let Task 3 reuse it)

**Files:**
- Create: `eslint.quality.config.js`, `scripts/check-changed-quality.ts`, `scripts/check-changed-quality.test.ts`, `tests/lint/quality-config.test.ts`, `docs/developer/quality-limits.md`
- Modify: `package.json` (`check:quality`, `report:quality`), `AGENTS.md` (Commands table), `docs/engineering.md` (section 3: one line linking the limits)

**Interfaces:**
- Consumes: `changedFiles(base, cwd)` from `scripts/lib/changed-files.ts` (Task 3).
- Produces, `scripts/check-changed-quality.ts`:

```ts
export const QUALITY_PATHS: RegExp      // frontend/src/**, scripts/**, backend/pb_hooks/** with .ts .tsx .js extensions, excluding tests (*.test.*, *.spec.*), tests/**, e2e/**
export function filesToCheck(changes: Change[]): string[]   // added, modified, renamed (new path) that match QUALITY_PATHS; never deleted
```

Commands: `node scripts/check-changed-quality.ts [--base <sha>]` runs `npx eslint --config eslint.quality.config.js --no-warn-ignored <files>` on the changed files only, exit code from ESLint (1 on any violation), "check:quality: no changed source files" and exit 0 when there are none. `node scripts/check-changed-quality.ts --report` runs the same config over the whole repository, prints counts per rule and per file, and **always exits 0** (information only, design 6.4).

Limits **[my call; the design leaves the numbers to the builder]**: `max-lines-per-function` 50 (skip blank lines and comments; `.tsx` files 80 because a React component holds its markup), `complexity` 10, `max-depth` 4, `max-params` 5, `no-debugger`, `no-console` in `frontend/src/**` and `backend/pb_hooks/**` (scripts print by design and are exempt). `eslint.quality.config.js` reuses the parsers of `eslint.config.js` but none of its rules, so the normal `npm run lint` is unchanged.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 4A: the config

- [ ] **Step 1: Write failing tests** `tests/lint/quality-config.test.ts` (use ESLint's `Linter` or `ESLint` class from the installed package on in-memory source with the config): `a 51-line function in frontend/src/ fails max-lines-per-function`; `a 50-line function passes`; `a 60-line .tsx component passes and a 81-line one fails`; `complexity 11 fails and 10 passes`; `nesting depth 5 fails`; `6 parameters fail`; `console.log in frontend/src/ fails and in scripts/ passes`; `debugger fails everywhere`; `a long function in a *.test.ts file is not checked` (via `filesToCheck`, see 4B); `a .js pb_hook lib file with the same problems fails (CommonJS, require and module.exports parse)`.
- [ ] **Step 2: Run** `npx vitest run --project unit tests/lint/quality-config.test.ts`; FAIL. **Step 3: Write `eslint.quality.config.js`**. **Step 4: Run**; PASS. **Step 5: Close checkpoint 4A** (commit `feat: quality lint config`).

## Checkpoint 4B: changed files only

- [ ] **Step 6: Write failing tests** `scripts/check-changed-quality.test.ts`: `filesToCheck keeps added, modified and renamed source files`; `deleted files and test files and docs are skipped`; `a renamed file is checked under its new path`; `files outside QUALITY_PATHS are skipped`; and in a temp git repo with the config copied in: `a changed file with a violation exits 1 and names the file and rule`; `a violation in an untouched file is not reported by the default run but is counted by --report`; `--report exits 0 even with violations`; `no changed source files exits 0 with a message`.
- [ ] **Step 7: Run**; FAIL. **Step 8: Implement.** **Step 9: Run**; PASS.
- [ ] **Step 10: Report on this repo.** Run `node scripts/check-changed-quality.ts --report`; paste the counts in `docs/developer/quality-limits.md` as "state on <date>" (so later work can see old code is not being forced to change), with the rule table and the reason for each limit ("readable beats clever", engineering.md).
- [ ] **Step 11: Wire up and verify.** Scripts, `AGENTS.md`, `docs/engineering.md` link. `npm run lint`, `npm run typecheck`, `npm run test:unit` green (the new config must not make `npm run lint` fail: the quality config is only used by these commands). Commit `feat: quality limits on changed files`. **Step 12: Close checkpoint 4B.**

## Test plan

Builds the checks (see Task 2 note). Review Focus 5: the renamed and deleted file cases in `filesToCheck`.
