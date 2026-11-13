# The Test plan block

Every task file in a plan written under the `test-plan-v1` standard carries a Test plan block. It is the written contract for "done": which behaviours are tested, by which test, which deliberate breaks the tests must catch, and what the implementer pastes as evidence. `npm run check:plan` enforces the format; the parser is `scripts/lib/test-plan.ts`. Layers and the probe form are defined in [testing-strategy.md](../testing-strategy.md).

## What a task file carries

| Part | Form | Rule |
|---|---|---|
| Tier | A line `**Model tier:** strong`, `mid` or `local` | Required. A per-checkpoint line `**Checkpoint 2B tier:** local` is optional, and its value must be a tier name too |
| Interfaces | A line or block starting `**Interfaces:**` | Required. Write `none` if there are none |
| Test plan | The `## Test plan` block below | Required |

## The block

```
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

## What `check:plan` enforces

- The five `###` sections exist, once each, spelled exactly and in this order. An unknown, missing, repeated or misplaced section is a problem; so is text before the first section.
- Tables have the exact header above, a `|---|` separator line, at least one row and the right number of cells. A table with no rows is a problem, never "zero cases".
- **Cases:** ID unique and not empty; Behaviour, Input and Expected not empty; Layer one of `unit`, `rules`, `e2e`, `container`, `manual`; Test written `path :: title` unless the layer is `manual`.
- **Probes:** the line `**Probe folder:**` is present and its value starts with `tests/probes/` (or is `none`, meaning no probes).
- **Breaks:** either a lone line `none` (any case), allowed only when no case is on the `unit` layer (otherwise a problem naming the unit rows), or a table with at least one row; a header with no rows and no `none` is a problem. Rows: ID unique; File passes `isBreakablePath` (under `src/`, `scripts/` or `backend/pb_hooks/lib/`; not a test file; no `..`; not absolute); Find not empty and different from Replace; Tests lists one or more comma-separated relative paths.
- **Flow** and **Evidence** are not empty.
- Every problem names the section and the row id, and starts with the task file path.

A line that is entirely an HTML comment (`<!-- ... -->`) inside the block is ignored, so a comment-only Flow is still empty.

Cell syntax: a cell may be wrapped in one pair of backticks, which is stripped; backticks inside the cell stay. A literal pipe is written `\|` and read as `|`. An empty Replace means "delete the Find text".

The default scan (`npm run check:plan` with no argument) checks only plan folders whose `README.md` has the line `**Standard:** test-plan-v1`, and only their `task-*.md` files. `node scripts/check-plan.ts <dir>` checks a given folder whatever its README says. Exit 1 prints the problems; exit 0 prints `check:plan: N task files ok`. The skeleton to copy is [TASK-TEMPLATE.md](../superpowers/plans/TASK-TEMPLATE.md).

## Writing good Cases

One row per behaviour, not per function. Cover the kinds from the catalogue in [testing-strategy.md](../testing-strategy.md) section 4 that fit the code. The Test column must name a test that exists; use the exact title.

## Writing good Probes

Probes are written from the Cases and the catalogue, not from the task's own tests, and the task prompt never names the folder. Title form: `[<row id>] <kind>: <description>`.

## Writing good Breaks

A break is a one-line change to a decision in the code: a comparison, a boundary, a removed guard. Two or three per risky function. A task whose cases are only `rules`, `e2e`, `container` or `manual` has no code Vitest reaches and writes `none` under Breaks. The listed tests must fail when the change is applied. Breaks apply only to code Vitest reaches; a hook file is covered by rule tests (design 6.3), so put its pure decision in `backend/pb_hooks/lib/` and break that. Find must match exactly once in File.

## Running the breaks

`npm run check:breaks -- <task.md>` (or `node scripts/run-breaks.ts [--cwd <dir>] <task.md>`) proves that the tests a task names would notice its deliberate breaks. The logic is `scripts/lib/breaks.ts`; the command is `scripts/run-breaks.ts`. `--cwd` is the project the paths in the Breaks table are relative to (default: the current directory); the task path is relative to where the command is started.

1. The task file is parsed as above. Any problem in the Test plan block stops the run with exit 1: fix it first with `npm run check:plan`.
2. No breaks (`none`): exit 0 with `no breaks listed` when no case is on the `unit` layer, exit 1 otherwise.
3. **Baseline:** the union of all named test files runs once, unbroken (`vitest run --project unit <paths>`, using this repository's Vitest). If they fail, no break is applied and the command exits 1: a break proves nothing against red tests. A named test file that does not exist, or that did not run in the `unit` project (for example a rules test; checked against Vitest's JSON report), also stops the run with exit 1, since Vitest would otherwise fail with "No test files found" and look like a catch. Every test run is checked this way, not only the baseline.
4. **Each break**, one at a time, always starting from the original file: the file is read, Find is replaced (as literal text, exactly once), the break's own tests run, and the original bytes are written back. Output, one line per break:
   - `B1 caught`: the tests failed. This is what you want.
   - `B2 SURVIVED: the tests did not notice <file>: <find> -> <replace>`: the tests still pass with the break applied. Add the test that pins that decision.
   - `B3 invalid: <why>`: nothing was written. Find occurs zero or several times, the file cannot be read or is not breakable, or no tests are named.
5. Exit 0 only when every break is caught; exit 1 if the baseline failed or any break survived or was invalid.

**The restore guarantee.** The original is written back in a `finally`, so it comes back whether the tests pass, fail or crash. Files are read and written byte for byte (CRLF, a missing final newline and non-ASCII text are kept). A SIGINT (Ctrl-C) or SIGTERM while a break is applied restores that file, stops Vitest and exits 130 or 143 with `restored <file>`. A Vitest run stopped by a signal from outside is an error, never a catch.

**If the command was killed hard** (SIGKILL, power loss) while a break was applied, run `git status`: a file under `src/`, `scripts/` or `backend/pb_hooks/lib/` that you did not edit is a left-over break; `git checkout -- <file>` puts it back (only if you made no edits to it).
