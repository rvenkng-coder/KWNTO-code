# Design: Letting the local AI do most of the work, with proof

Date: 2026-11-13
Status: Draft for approval
Sources: the developer's answers in chat on 2026-11-13, [design section 8c](2026-11-11-kwnto-design.md), [local-model-notes.md](../../developer/local-model-notes.md), and what Tasks 1 to 4 of [Plan 2](../plans/2026-11-12-accounts-teams/README.md) showed. Items marked **[my call]** were decided by the designer, not the developer; please review them.

## 1. Intent

The developer wants the cheaper local model (see local-model-notes.md) to do **most of the project's coding**, so the stronger models are free for planning, security-sensitive work and review. That only works if the local model can **prove its own work** is finished: tested, functional and well written, without a stronger model reading every line.

The one thing that would make this a failure in the developer's words: a task comes back **not tested, or tested and still not functional**. In the smoke tests and in Plan 2 the cause was the same: nothing told the model which tests to write, so it tested the cases it was shown and missed their relatives. This design gives every model, local or strong, the same written basis for testing, and one command that checks the work.

## 2. Goals

- A local model can take **one whole task** from a plan and finish it alone, checkpoint by checkpoint, and show evidence that it is done.
- "Done" means three things, all checked by tools where possible: **tested** (every case in the task's test plan has a passing test that fails when the code is broken), **functional** (the feature works when used, not only in isolation), and **good code** (the engineering rules are enforced by tools, not by trust).
- Stronger models are used for: writing the strategy and the test plans, security-critical code, and **sampled** review.
- Each miss is recorded once and prevented afterwards (a learning loop).
- Everything is free to run and needs no new paid service.

## 3. Non-goals

- No coverage-percentage target (design section 8b already rejects one).
- No replacement of the strong tier for access rules, auth, sync and conflicts, or other security-sensitive work (design 8c). The local model's strong-tier ability is untested.
- No automatic merging. The developer still reviews branches; agents never merge (engineering.md section 7).
- No new heavy test infrastructure for its own sake (see constraints on dependencies).

## 4. Anti-goals (a failure even if it technically works)

- Checks that the model can satisfy without doing the real work: a test that cannot fail, a "check" that passes silently on bad input, a self-report taken as evidence.
- More process than code: a plan whose test plan is longer than the feature it tests.
- A standard that is written once and then ignored because running it is too slow or too fiddly.
- Strong-model cost that does not go down.

## 5. Current state

- Design 8b lists the test layers (unit, backend rules, end-to-end, manual checklist, one command) and a manual sign-off checklist for the developer. No document says, per feature, which layer must cover it.
- Plans carry a model tier per **task** (strong, mid, local-OK) and tests are written inside each task. Plan 2's tasks 1 to 8 are strong; 9 and 10 are for the local model.
- Existing checks: `npm run lint` (ESLint guardrails, the `PERF:` comment check, the docs link check), `typecheck`, and four test layers. The local model runs as `little-coder -p` and is graded by hand after the run, using the checklist in local-model-notes.md.
- What the smoke tests and Plan 2 showed: the local model follows process and reports honestly, but fixes the stated cases and misses their relatives; and plans written ahead of the code go stale (the real-time spike changed the data model; Plan 2 found hook names and behaviours that differed from the plan).

## 6. The system

Four parts, plus changes to how plans are written. Names and paths are **[my call]** unless stated.

### 6.1 Test strategy (project-wide, written once)

A document, `docs/testing-strategy.md`, written by a strong agent. It is stable: it changes only when a lesson is learned. It states:
- the test layers and **when each is required** (a rule change needs a rule test; a screen needs an end-to-end test; pure logic needs unit tests; what no test can show needs a manual step);
- conventions: where tests live, names, shared helpers, the header comment every test carries;
- the **catalogue of awkward cases by kind** (empty and huge input, the second bad item hiding behind a good first one, the same bug in a "relative" form, ordering, case and whitespace, the forbidden actor trying the allowed action, an open rule that a test would not notice, and so on), seeded from what Plans 1 and 2 found;
- the **definition of done** and what counts as evidence;
- the quality checks every task ends with (6.4).

It extends design section 8b and `engineering.md` section 6; it does not replace them.

### 6.2 Project test plan (project-wide, feature level)

A document, `docs/test-plan.md`: for every feature in design section 6, the layers that must cover it and its status (not started, in progress, covered), plus the manual sign-off checklist that design sections 8 and 8b already require. It is stable at feature level and cheap to keep current: each plan updates its own rows as it lands. It shows gaps early and is the basis every task's test plan hangs from. **It does not contain detailed cases**; those would go stale (the spike and Plan 2 both changed what the right tests were).

### 6.3 Per-task test plan (written just before each plan, by a strong agent)

Every task file in a plan gets a **Test plan** block, written when the plan is written, from the real code at that moment. It has:
- a **case table**: each behaviour, the layer that tests it, the exact input and the expected result;
- a **probe set**: awkward cases from the catalogue the implementer is **not shown**. Probes live in their own folder (for example `tests/probes/<plan>/<task>/`), which the task prompt never mentions, and **`check:task` runs them on every task**, not only the sampled ones. Its output says which row and which *kind* of case failed, never the probe's input, so a failure teaches the model the class and not the example. The model is told not to read that folder; the session log shows whether it did **[my call; it cannot be truly sealed, so this is a norm checked in review]**;
- **deliberate breaks** (mutations): for each risky function, two or three one-line breaks the tests must catch. In the first version breaks apply only to code that Vitest can reach (pure functions in `src/`, `scripts/` and `backend/pb_hooks/lib/`); migrations, hooks and access rules are covered by their rule tests, which must include an "open the rule and watch the test fail" check done once by the implementer and verified in sampled review **[my call: restarting PocketBase for every break would make a run too slow]**;
- the **end-to-end flow** or manual steps for anything a person uses;
- the **self-check evidence** the implementer pastes into its report (6.4).

### 6.4 The self-check command

One command, for example `npm run check:task` **[my call on the name]**, that the implementer runs at the end of a task and pastes the output into its report. It does what the grading checklist in local-model-notes.md does by hand, so grading stops depending on a person remembering it:
- lint, typecheck and the test layers the task needs;
- **test hygiene:** every test has a header comment; no test lost a line compared with the base commit; no skipped or focused tests;
- **code quality:** the existing guardrails (file length, no `any`) plus new ones enforcing "readable beats clever": a limit on function length and complexity, and no leftover debug output **[my call; exact limits left to the builder]**;
- **test-plan coverage:** each row of the case table points at a test, and each listed deliberate break makes at least one test fail (the command applies the break, runs the named tests, and restores the file);
- a clear pass or fail and the failing rows, so a model can act on it without a person.

**Scope and speed [my call].** The new quality limits (function length, complexity) apply to the **files a task changed** (checked against the base commit), not the whole repository, so old code needs no clean-up before the standard starts; a repo-wide report of violations is produced for information only. The command runs the unit layer and the layers the task's Test plan names; a typical run should stay within a few minutes and the whole command has a ten-minute limit.

A task with a failing self-check cannot be closed.

### 6.5 Sampled review

A strong model reviews **about one local task in three**, plus a whole-branch review at the end of each plan, **[my guess at the sample rate; the developer said "only a sample"]**. The sample is not random: tasks that touch access rules, auth, sync or data are always reviewed, and the sample rate rises when the escape rate (6.6) rises. Reviewers check the diff against the test plan and the standards, not the model's own summary. A reviewed task records what was found.

### 6.6 Learning loop and measurement

- Every miss a review or the developer finds is added to the awkward-case catalogue (6.1) and, if a tool could have caught it, to the self-check (6.4).
- `progress.md` gets two small columns per task **[my call]**: who built it (local or strong) and whether it was reviewed and what was found. From that, a plan's **escape rate** (problems found after a task was closed) can be read off. The developer can tell whether the local model is earning more work.

### 6.7 Changes to how plans are written

- The local model is **run by guidance, not by a new runner** in the first version: a short written procedure (confirm the server answers, start `little-coder -p` with a session folder, check for a session file after a minute) and an optional ping script for the server check. A full runner would touch the developer's local setup and can come later **[my call]**.
- The model tier is set **per checkpoint**, not only per task. A task meant for the local model is **sized for it**: small enough to finish alone, with its files and interfaces listed, a "stop and report if you need to touch anything else" rule, and a check that the model server is alive before a long run (it can stall silently).
- Every task carries the Test plan block (6.3). A **plan check** script refuses a task file with a missing tier, Interfaces block or Test plan, so the standard cannot be skipped **[my call]**.
- Plans stay written one at a time, just before they are built.

## 7. Constraints

- Zero cost; no new dependency without a decision record and the developer's approval (engineering.md section 4). A mutation-testing library would need one; the first version uses hand-listed breaks and so needs none.
- Scripts are TypeScript run directly with `node`, as in `scripts/`. They have their own unit tests.
- The strong tier keeps security-sensitive work (design 8c) and the final say on what ships.
- The local model's known limits (local-model-notes.md) bind: it solves stated examples and misses their relatives, it can stall without saying so, and runs take 10 to 15 minutes per checkpoint. The gain expected is **cost**, not speed.

## 8. Left to the builder

- The exact name, options and output format of the self-check command and the plan check.
- The complexity and function-length limits, and how the "deliberate break" mechanism applies and restores a change safely.
- The file formats and templates for the strategy, the project test plan and the Test plan block.
- How the catalogue of awkward cases is organised, and how it is turned into probe sets.
- How the sample for review is chosen in practice.

## 9. Calls made without the developer (please check)

1. Names and locations: `docs/testing-strategy.md`, `docs/test-plan.md`, `npm run check:task`.
2. The sample rate of about one task in three, with always-review for rules, auth, sync and data.
3. Limiting function length and complexity as part of the quality checks.
4. Two extra columns in `progress.md` and an escape-rate measure.
5. A plan check script that rejects task files without a tier, interfaces and test plan.
6. Starting without a mutation-testing library (hand-listed breaks only).
7. **Sequencing (decided by the developer, 2026-11-13): Plan 2 is finished first, then this tooling is built.** The new standard applies from the plan after Plan 2 onward. Plan 2's Tasks 9 and 10 therefore go to the local model **without** `check:task`, graded by hand with the checklist in local-model-notes.md, as Plan 2 already says.
8. Probes run on every task, in a folder the prompt does not mention (section 6.3).
9. Breaks in the first version apply only to code Vitest can reach (section 6.3).
10. New quality limits apply to changed files only; no clean-up checkpoint (section 6.4).
11. Guidance and an optional ping script, not a model runner (section 6.7).
