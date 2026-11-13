# Task 1: Test strategy and project test plan

Part of the [Local-AI Quality plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong  
**Depends on:** none

**Files:**
- Create: `docs/testing-strategy.md`, `docs/test-plan.md`
- Modify: `AGENTS.md` (Read first list), `docs/README.md` (index), `docs/engineering.md` (section 6: one line pointing to the strategy), `docs/developer/testing.md` (one line pointing to the strategy)

**Interfaces:**
- Consumes: design sections 6, 8 and 8b (the layers and the manual sign-off checklist), `docs/engineering.md` section 6, `docs/developer/testing.md`, `docs/developer/local-model-notes.md`, and the findings of Plans 1 and 2 (`.planning/*/findings.md`, `.superpowers`-free: use only tracked files).
- Produces: the stable names the later tasks cite: layer names `unit`, `rules`, `e2e`, `container`, `manual`; the test header form `// Protects: <requirement or risk>`; the probe title form `[<row id>] <kind>: <description>`; the case catalogue kind slugs listed in Step 3.

These are documents, not code: the tests are the link check (`npm run check:docs`) and a reading by the reviewer against the checklist in Step 6.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 1A: the strategy

- [ ] **Step 1: Write `docs/testing-strategy.md`** with these sections, each short and concrete (a table or list, not prose):
  1. **Purpose and who reads it** (every model and person; stable; changes only when a lesson is learned).
  2. **The layers and when each is required:** a table with columns layer, tests what, lives in, command, required when. Rows: `unit` (pure logic; `src/**`, `scripts/**`, `tests/hooks/**`; `npm run test:unit`; any function with a decision in it), `rules` (access rules, hooks, routes against a live PocketBase; `tests/rules/**`; `npm run test:rules`; any collection, rule, hook or route change), `e2e` (a person's flow in a browser; `e2e/**`; `npm run test:e2e`; any screen or flow), `container` (image hardening), `manual` (what no test can show: look and feel, real mail, exports). State the rule "a rule change needs a rule test that fails when the rule is opened".
  3. **Conventions:** where files live, names (`<feature>.rules.test.ts`, `<name>.unit.test.ts`, `<feature>.spec.ts`), shared helpers (`tests/rules/helpers/`, `e2e/helpers/`), the header comment `// Protects: <requirement or risk>` before every test, tests never edited to pass (if a test fails for a reason you did not expect, stop and explain), fresh users per test, restore global settings in `afterEach`.
  4. **The catalogue of awkward cases by kind:** the table in Step 3.
  5. **Definition of done and what counts as evidence:** a task is done when `npm run check:task` passes and its output is pasted in the report; a self-report is not evidence; a test counts only if it fails when the code is broken (shown once by breaking it).
  6. **The quality checks every task ends with:** a short list naming each check `check:task` runs (filled in by Task 8; write the list now with the names `plan`, `lint`, `typecheck`, `unit`, `layers`, `hygiene`, `quality`, `coverage`, `breaks`, `probes`) and what each one proves.
  7. **Learning loop:** every miss a review or the developer finds is added to the catalogue (and to the self-check if a tool could have caught it) in the same pull request that fixes it.
  8. **Writing a probe:** the file name `tests/probes/<plan>/<task>/<row>.probe.test.ts`, the title form `[<row id>] <kind>: <description>`, and the rule that a probe never reads the code under test's own tests and the task prompt never names the folder.

- [ ] **Step 2: Test-plan block pointer.** In section 5 or a short section 9, say the per-task Test plan block is described in `docs/developer/test-plan-format.md` (written in Task 2); do not link a file that does not exist yet (the link check fails). Name it in backticks only.

- [ ] **Step 3: The catalogue.** Table with columns `kind` (slug), `what to try`, `seen in`. Seed with these kinds and the real cases that showed them (cite the plan or finding in words, not a link):
  - `relative-of-fixed-case`: after fixing a stated case, try its relatives (a comment after code, then a block comment after code). Seen: Plan 1 PERF check.
  - `second-bad-item`: a good first item hides a bad second one. Seen: Plan 1 PERF notes in one run.
  - `two-bad-items`: two bad items in one input are judged separately.
  - `empty-one-huge`: empty, one, and a very large input.
  - `case-and-whitespace`: capitals, stray spaces, non-ASCII. Seen: Plan 2 email lookups (reset typed with capitals sent no mail).
  - `wrong-actor`: the forbidden actor tries the allowed action: member, owner of another team, outsider, signed-out, blocked user. Seen: Plan 2 regenerate and invite routes.
  - `open-rule-unnoticed`: a rule opened by mistake must make a test fail. Seen: every Plan 2 rule test (checked once by opening the rule).
  - `oracle-leak`: unknown and wrong answers must look the same (status, message, body). Seen: Plan 2 join code and invite.
  - `race-and-parallel`: two requests at once, or a UI step before the request ends. Seen: Plan 2 parallel wrong passwords beat the lockout; sign-up then verify raced in e2e.
  - `vacuous-absence`: "X is not shown" passes before the data has loaded; wait for a positive signal first. Seen: Plan 2 e2e after reload.
  - `visible-not-enabled`: `toBeVisible` passes on a disabled control; use `toBeEnabled`. Seen: Plan 2 verification gate.
  - `success-on-failure`: a success note or state shown after a failed call. Seen: Plan 2 "Joined successfully!" and the sign-up confirmation.
  - `stale-after-change`: a list or count after delete, answer, remove or reload. Seen: Plan 2 invites after answering; team list after delete.
  - `refused-vs-failed`: a refusal (401, 403, 404) ends a session, a dead server does not. Seen: Plan 2 refresh.
  - `secret-in-output`: secrets in command arguments, logs or messages. Seen: Plan 2 incident runbook.
  - `helper-hides-bug`: a test helper or mapper that "fixes" what the code under test gets wrong. Seen: Plan 2 `toPlain` and the `user_id` mapper test.
  - `test-asserts-the-mock`: a test whose only assertion is a value it set itself.

- [ ] **Step 4: Verify.** Run `npm run check:docs`; expected: no broken links. Commit: `docs: test strategy for every model`.

- [ ] **Step 5: Close checkpoint 1A** (tick the boxes above, progress line, one commit if anything changed).

## Checkpoint 1B: the project test plan

- [ ] **Step 6: Write `docs/test-plan.md`.** Sections: (a) how to read it and who updates it (each plan updates its own rows when it lands; feature level only, no detailed cases, because those go stale); (b) the feature table with columns `feature`, `design`, `layers required`, `status` (`not started`, `in progress`, `covered`), `plan` (which plan builds it, from the roadmap). One row per feature of design section 6 (6.1 to 6.9) and for the account and team features of Plan 2 (sign-up and verification, password rules, lockout, block and lockdown, incident controls, teams and members, join code, invites, security log, per-user and system settings). Plan 2 rows are `covered` with the layers they have (rules, unit, e2e). Later plans' rows are `not started`. (c) **Manual sign-off checklist:** the checklist design sections 8 and 8b require (light and dark look, Player Mode transitions, PDF, Word, JPG and PNG exports, run in Firefox and Chrome), plus the Plan 2 items nobody can automate (real verification and reset mail, once SMTP exists). Mark each item `open`.

- [ ] **Step 7: Link them.** `AGENTS.md` Read first list gets items for the strategy and the test plan (the list is in order; put them after "Security rules"). `docs/README.md` index gets both. `docs/engineering.md` section 6 and `docs/developer/testing.md` each get one sentence and a link to `testing-strategy.md`.

- [ ] **Step 8: Verify.** `npm run check:docs` clean. Reviewer checklist (the controller checks each): every feature in design section 6 has a row; no row claims `covered` for something with no test; the catalogue has all kinds in Step 3 with their slugs; no link to a file that does not exist; `AGENTS.md` still under its size and its "Hard rules" unchanged.

- [ ] **Step 9: Close checkpoint 1B.** Commit: `docs: project test plan and links`.
