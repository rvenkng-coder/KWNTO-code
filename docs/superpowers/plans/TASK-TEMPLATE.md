# Task N: <name>

<!-- Link back to the plan router. Say the router's Global Constraints apply. -->
Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

<!-- Who may do this task: strong, mid or local. check:plan rejects any other word. -->
**Model tier:** local
<!-- Optional: a different tier for one checkpoint. -->
**Checkpoint NA tier:** local
**Depends on:** none

<!-- Every file the task creates or changes. -->
**Files:**
- Create: `scripts/example.ts`, `scripts/example.test.ts`
- Modify: `package.json`

<!-- Exact names, signatures and types other tasks or tests rely on. Write `none` if there are none. -->
**Interfaces:**
- Produces: `export function example(input: string): string[]`

**If interrupted:** nothing leaves state outside the working tree.

<!-- Required when the tier (or any checkpoint tier) is local; delete this block for strong and mid tasks. check:plan checks the five parts. Put it before "## Test plan". -->
## Sized for the local model
**May touch:** `scripts/example.ts`, `scripts/example.test.ts` (exhaustive: no other file)
**Must not change:** the signature of `example`, and every existing test
Stop and report if you need to touch anything else.
**Model server:** run `npm run ping:model` first; if it says NOT answering, do not start the run (see [the runbook](../../developer/local-model-runbook.md))
**Checkpoint given:** Checkpoint NA only

## Checkpoint NA: <name>

<!-- Steps in order: tests first, then watch them fail, then implement, then pass, then one commit. -->
- [ ] **Step 1: Write failing tests**
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run, expect PASS. Close the checkpoint (one commit)**

## Test plan

<!-- The contract for "done". Format: docs/developer/test-plan-format.md. Replace <plan> and <task>. -->
### Cases
<!-- One row per behaviour. Test is "path :: title" (empty for manual). Layers: unit, rules, e2e, container, manual. -->
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | empty input | unit | `example("")` | `[]` | scripts/example.test.ts :: empty input |
### Probes
<!-- Where the unseen probes for this task live. The task prompt never names it. `none` for no probes. -->
**Probe folder:** `tests/probes/<plan>/<task>/`
### Breaks
<!-- One-line changes to a decision; the listed tests must fail. File under src/, scripts/ or backend/pb_hooks/lib/`. Write only `none` (no table) if no case is on the unit layer. -->
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | scripts/example.ts | `a < b` | `a <= b` | scripts/example.test.ts |
### Flow
<!-- The person-facing flow to run and record, or `none`. -->
none
### Evidence
<!-- What the implementer pastes into the report. -->
The full output of `npm run check:task` and the failing run of each break.
