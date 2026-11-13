# Task 6: Probe runner

Part of the [Local-AI Quality plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid  
**Depends on:** Task 2 (`probeFolder`)

**Files:**
- Create: `scripts/lib/probes.ts`, `scripts/lib/probes.test.ts`, `scripts/run-probes.ts`, `scripts/run-probes.test.ts`, `tests/probes/README.md`
- Modify: `vitest.config.ts` (a `probes` project; the existing `unit` project must not pick probes up), `package.json` (`check:probes`), `docs/developer/test-plan-format.md`, `docs/testing-strategy.md` (probe writing, if wording needs a change), `AGENTS.md`

**Interfaces:**
- Produces, `scripts/lib/probes.ts`:

```ts
export function parseProbeTitle(title: string): { row: string; kind: string } | null   // "[C3] second-bad-item: two items" -> { row: "C3", kind: "second-bad-item" }
export interface ProbeSummary { total: number; passed: number; failed: { row: string; kind: string }[]; unnamedFailures: number; loadErrors: number }
export function summariseProbeRun(vitestJson: unknown): ProbeSummary   // reads the vitest JSON reporter output; never keeps an error message
export function formatProbeSummary(s: ProbeSummary): string[]          // lines for the report; contains row and kind only
```

- Produces, `scripts/run-probes.ts`: `node scripts/run-probes.ts <probe folder>`; runs `npx vitest run --project probes --reporter=json <folder>`, prints `FAIL <row> (<kind>)` per failure and `probes: N of M passed`; **never prints an assertion message, a stack, an expected or received value or a source line**; exit 1 on any failure, on a folder that does not exist (a task that lists a probe folder must have one) and on an empty folder; exit 0 only if at least one probe ran and all passed.
- Probe files: `tests/probes/<plan>/<task>/<row>.probe.test.ts`, titles `[<row id>] <kind>: <description>`, the kind a slug from the catalogue in `docs/testing-strategy.md`.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 6A: parsing and formatting

- [ ] **Step 1: Write failing tests** `scripts/lib/probes.test.ts`: `parseProbeTitle reads row and kind`; `a title without the form gives null`; `a kind with spaces or capitals gives null`; `summariseProbeRun counts passed and failed from a sample JSON`; `a failure with an unparsable title counts as unnamedFailures`; `a test file that failed to load counts as loadErrors`; `formatProbeSummary output never contains the failure message, "expected", "received", "Error" or a path with a line number` (feed JSON whose messages contain those words and a secret-looking input string; assert none appear); `an empty result is total 0`.
- [ ] **Step 2: Run** `npx vitest run --project unit scripts/lib/probes.test.ts`; FAIL. **Step 3: Implement.** **Step 4: Run**; PASS. **Step 5: Close checkpoint 6A** (commit `feat: probe summary`).

## Checkpoint 6B: the project and the command

- [ ] **Step 6: Add the `probes` project** to `vitest.config.ts` (`include: ['tests/probes/**/*.probe.test.ts']`, name `probes`) and make sure `unit`, `rules` and `container` do not match `*.probe.test.ts` (add `exclude` if needed). Add a test in `tests/lint/` asserting that a file `tests/probes/x/y/a.probe.test.ts` is matched by `probes` and by none of the others (read the config and apply the globs with `node:path` `matchesGlob`).
- [ ] **Step 7: Write failing tests** `scripts/run-probes.test.ts` with a temp fixture folder (`--cwd` option as in Task 5): `all passing probes exit 0 and say N of N`; `a failing probe prints FAIL <row> (<kind>) and exits 1`; `the output does not contain the probe's input value` (the fixture probe asserts on a distinctive string `SECRET-INPUT-123` and fails; the string must not be in stdout or stderr); `a missing folder exits 1`; `an empty folder exits 1`; `a probe file with a syntax error exits 1 and is counted as a load error`; `the vitest output is not echoed on a crash` (stdout and stderr of the child are captured, not inherited).
- [ ] **Step 8: Run**; FAIL. **Step 9: Implement** the command; **Step 10: Run**; PASS.
- [ ] **Step 11: Write `tests/probes/README.md`** (what a probe is, the title form, that these files are run only by `check:task` and `check:probes`, that the prompt for a task never names them, that the implementer is told not to read this folder and the session log shows whether it did). Commit `feat: probe runner`. **Step 12: Verify** `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run check:docs`. **Step 13: Close checkpoint 6B.**

## Test plan

Builds the checks. Review Focus 3 is the test `the output does not contain the probe's input value`.
