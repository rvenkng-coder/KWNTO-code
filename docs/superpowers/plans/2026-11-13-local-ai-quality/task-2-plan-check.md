# Task 2: Test plan block, plan parser and `check:plan`

Part of the [Local-AI Quality plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid  
**Depends on:** Task 1 (the layer names and the probe and header forms)

**Files:**
- Create: `scripts/lib/test-plan.ts`, `scripts/lib/test-plan.test.ts`, `scripts/check-plan.ts`, `scripts/check-plan.test.ts`, `docs/developer/test-plan-format.md`, `docs/superpowers/plans/TASK-TEMPLATE.md`
- Modify: `package.json` (scripts `check:plan`, and add it to `lint`), `docs/developer/testing.md`, `AGENTS.md` (Commands table), `docs/testing-strategy.md` (link to the format file)

**Interfaces:**
- Consumes: layer names from Task 1.
- Produces, `scripts/lib/test-plan.ts`:

```ts
export type Layer = 'unit' | 'rules' | 'e2e' | 'container' | 'manual'
export interface CaseRow { id: string; behaviour: string; layer: Layer; input: string; expected: string; test: string } // test is "path :: title", or "" for manual
export interface BreakRow { id: string; file: string; find: string; replace: string; tests: string[] }
export interface TestPlan { cases: CaseRow[]; probeFolder: string | null; breaks: BreakRow[]; flow: string; evidence: string }
export interface TaskMeta { tier: 'strong' | 'mid' | 'local' | null; hasInterfaces: boolean }
export function parseTaskMeta(markdown: string): TaskMeta
export function parseTestPlan(markdown: string): { plan: TestPlan | null; problems: string[] } // plan is null when the block is missing
export function isBreakablePath(path: string): boolean  // under src/, scripts/ or backend/pb_hooks/lib/; not a test file; no ".." segment; not absolute. Task 5 imports this, it does not redefine it
```

- Produces, `scripts/check-plan.ts`: `checkTaskFile(path: string, markdown: string): string[]` (problems, each starting with the file path) and `checkPlanFolder(dir: string): string[]`. Command: `node scripts/check-plan.ts [dir ...]`; with no argument it checks every folder under `docs/superpowers/plans/` whose `README.md` contains the line `**Standard:** test-plan-v1`; exit 1 with the problems printed, exit 0 and "check:plan: N task files ok" otherwise.

**The Test plan block format** (the thing both scripts and `docs/developer/test-plan-format.md` define; **[my call]** on the exact shape). A task file has a heading `## Test plan` with these `###` sections in this order; a table is a GitHub markdown table:

```
**Model tier:** local          (strong | mid | local; a line near the top)
**Interfaces:** ...            (a line or block; the word must be present)

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | empty input | unit | `f("")` | `[]` | scripts/x.test.ts :: empty input |
### Probes
**Probe folder:** `tests/probes/<plan>/<task>/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | scripts/x.ts | `a < b` | `a <= b` | scripts/x.test.ts |
### Flow
text, or `none`
### Evidence
text of what the implementer pastes
```

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 2A: the parser

- [x] **Step 1: Write failing tests** in `scripts/lib/test-plan.test.ts`, each with a `// Protects:` header. Cases (names are the test titles): `parses a full block`; `a missing Test plan heading gives plan null`; `a table with no rows gives a problem (not zero cases silently)`; `an unknown layer is a problem`; `a case row without a test reference is a problem unless the layer is manual`; `duplicate case ids are a problem`; `a break with empty Find is a problem`; `a break whose file is outside src/, scripts/, backend/pb_hooks/lib/ is a problem`; `isBreakablePath accepts src/a.ts, scripts/x.ts, backend/pb_hooks/lib/y.js and rejects tests/x.ts, src/a.test.ts, ../x.ts, /etc/passwd, backend/pb_hooks/users-signup.pb.js (a hook is covered by rule tests, design 6.3)`; `a break row's Tests cell may list several comma-separated paths`; `the probe folder must start with tests/probes/`; `Flow and Evidence sections must not be empty`; `sections out of order or misspelled (### Case, ### Breaks ) are problems, not ignored`; `cells keep inner backticks and pipes escaped as \|`; `Windows line endings parse the same`; `parseTaskMeta finds tier and Interfaces; a bad tier name gives null`.
- [x] **Step 2: Run** `npx vitest run --project unit scripts/lib/test-plan.test.ts`; expected: FAIL (module not found).
- [x] **Step 3: Implement** `parseTestPlan` and `parseTaskMeta` in `scripts/lib/test-plan.ts` with a small line-based table parser (split on unescaped `|`, strip one pair of backticks from a cell). No markdown library. Every problem names the section and the row id. Fail closed: anything not understood is a problem.
- [x] **Step 4: Run** the test file; expected: PASS. **Step 5: Close checkpoint 2A** (commit `feat: test plan parser`).

## Checkpoint 2B: `check:plan` and the template

- [ ] **Step 6: Write failing tests** in `scripts/check-plan.test.ts` (temp directories via `mkdtempSync`): `a task with tier, Interfaces and a valid Test plan passes`; `missing tier, missing Interfaces and missing Test plan are each reported`; `a folder whose README lacks the Standard line is skipped by the default scan`; `a folder with the Standard line and a bad task file fails`; `a task-*.md file is checked, README.md and other files are not`; `an empty folder with the Standard line is a problem (no task files)`; `the command exits 1 on a problem and 0 otherwise` (spawn `node scripts/check-plan.ts <dir>`).
- [ ] **Step 7: Run** the file; expected FAIL. **Step 8: Implement** `checkTaskFile`, `checkPlanFolder` and the command. **Step 9: Run** again; expected PASS.
- [ ] **Step 10: Write `docs/superpowers/plans/TASK-TEMPLATE.md`**: a task file skeleton that passes `check:plan` (tier for the task and, where it differs, per checkpoint (`**Checkpoint 2B tier:** local`), depends on, files, interfaces, checkpoints, one example case row, break row, probe folder line, flow, evidence), with one-line comments saying what each part is for. The link check must pass, so reference no files that do not exist; the template's own Test plan uses placeholders `<plan>` and `<task>` and is excluded from the default scan because it is not in a folder with the Standard line.
- [ ] **Step 11: Write `docs/developer/test-plan-format.md`** (the format above, what `check:plan` enforces, how to write good Probes and Breaks: breaks are one-line changes to decisions, such as a comparison, a boundary or a removed guard; two or three per risky function; they apply only to code Vitest reaches). Add `check:plan` to `package.json` and to the `lint` script; add the Commands row to `AGENTS.md`; add a line to `docs/developer/testing.md` and the link in `docs/testing-strategy.md`.
- [ ] **Step 12: Verify.** `npm run lint` (check:plan finds no opted-in folder, prints "0 task files"), `npm run typecheck`, `npm run test:unit`; all green. Commit: `feat: check:plan and the task template`. **Step 13: Close checkpoint 2B.**

## Test plan

This task builds the format, so it cannot use it; its tests are the ones in Steps 1 and 6. Review Focus 4 (a block read as "no cases") is the test `a table with no rows gives a problem`.
