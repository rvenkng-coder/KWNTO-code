# KWNTO Test Strategy

The written basis for testing in KWNTO: which layer tests what, how tests are written, which awkward cases to try, and what counts as done. It extends design section 8b and [engineering.md](engineering.md) section 6; it does not replace them. Per-feature status is in [test-plan.md](test-plan.md). Commands and helpers are in [developer/testing.md](developer/testing.md).

## 1. Purpose and who reads it

- **Who:** every model (local, mid, strong) and every person who writes or reviews a test.
- **When:** before writing a task's tests, and before reviewing one.
- **Stability:** this page changes only when a lesson is learned (section 7). Names in it (layers, kinds, header and title forms) are cited by scripts and plans; do not rename them.

## 2. The layers and when each is required

| Layer | Tests what | Lives in | Command | Required when |
|---|---|---|---|---|
| `unit` | Pure logic: a function's decisions, without a server or browser | `src/**`, `scripts/**`, `tests/hooks/**` | `npm run test:unit` | Any function with a decision in it (a comparison, a branch, a limit, a parse) |
| `rules` | Access rules, hooks and custom routes, against a live PocketBase | `tests/rules/**` | `npm run test:rules` | Any change to a collection, rule, hook or route |
| `e2e` | A person's flow in a browser (Firefox and Chromium) | `e2e/**` | `npm run test:e2e` | Any new or changed screen or flow |
| `container` | Image hardening: non-root user, bootstrap, volume recovery | `tests/container/**` | `npm run test:container` | Any change to the Dockerfile, compose files or startup scripts |
| `manual` | What no test can show: look and feel, real mail, exports | the checklist in [test-plan.md](test-plan.md) | none (a person signs off) | Anything on the manual sign-off checklist, or a new item added to it |

- **A rule change needs a rule test that fails when the rule is opened.** Open the rule once (for example `""` or `@request.auth.id != ''`), watch the test fail, restore it, and say so in the report.
- A hook's pure decision goes in `backend/pb_hooks/lib/` with a `unit` test; the hook itself is covered by `rules`.
- Behaviour that depends on the caller's IP cannot be shown by `rules` (every request comes from one IP): pin it in the `unit` test of the helper and say so in the rule test file.

## 3. Conventions

| Topic | Rule |
|---|---|
| Unit test files | `<name>.unit.test.ts` in `tests/hooks/` (one per helper in `backend/pb_hooks/lib/`); beside the module as `<name>.test.ts` in `src/` and `scripts/` (existing form, also picked up by `test:unit`) |
| Rule test files | `tests/rules/<feature>.rules.test.ts`; for a collection, `<feature>` is the exact collection name (the coverage check requires it) |
| End-to-end files | `e2e/<feature>.spec.ts` |
| Shared helpers | `tests/rules/helpers/` for rule tests, `e2e/helpers/` for browser tests; look there before writing a new one |
| Header comment | `// Protects: <requirement or risk>` directly above every new test (no blank line between); cite the design section or the risk |
| Failing tests | Never edit a test to make it pass. If a test fails for a reason you did not expect, stop and explain |
| Users | A fresh user per test (`createUser()`, `uniqueEmail()`); never share accounts between tests |
| Global settings | A test that changes a global setting restores it in `afterEach`, not at the end of the test |
| Waiting | Never `waitForTimeout`; wait for something on the page |

## 4. The catalogue of awkward cases by kind

Try every kind that fits the code under test. `kind` is the slug used in probe titles (section 8).

| kind | what to try | seen in |
|---|---|---|
| `relative-of-fixed-case` | After fixing a stated case, try its relatives: a comment after code, then a block comment after code | Plan 1 PERF comment check |
| `second-bad-item` | A good first item followed by a bad second one; the bad one must still be reported | Plan 1 PERF notes in one run |
| `two-bad-items` | Two bad items in one input are judged separately; both are reported | Plan 1 PERF check probe set |
| `empty-one-huge` | Empty input, exactly one item, and a very large input | general |
| `case-and-whitespace` | Capitals, stray spaces, non-ASCII letters | Plan 2 email lookups (a reset typed with capitals sent no mail) |
| `wrong-actor` | The forbidden actor tries the allowed action: member, owner of another team, outsider, signed-out, blocked user | Plan 2 regenerate and invite routes |
| `open-rule-unnoticed` | Open the rule by mistake; a test must fail | every Plan 2 rule test (checked once by opening the rule) |
| `oracle-leak` | Unknown and wrong answers look the same: status, message and whole body | Plan 2 join code and invite |
| `race-and-parallel` | Two requests at once, or a UI step taken before the request ends | Plan 2 parallel wrong passwords beat the lockout; sign-up then verify raced in e2e |
| `vacuous-absence` | "X is not shown" passes before the data has loaded; wait for a positive signal first | Plan 2 e2e after reload |
| `visible-not-enabled` | `toBeVisible` passes on a disabled control; use `toBeEnabled` for a gate | Plan 2 verification gate |
| `success-on-failure` | A success note or state shown after a failed call | Plan 2 "Joined successfully!" and the sign-up confirmation |
| `stale-after-change` | A list or count after delete, answer, remove or reload | Plan 2 invites after answering; team list after delete |
| `refused-vs-failed` | A refusal (401, 403, 404) ends a session; a dead server does not | Plan 2 session refresh |
| `secret-in-output` | Secrets in command arguments, logs or messages | Plan 2 incident runbook |
| `helper-hides-bug` | A test helper or mapper that "fixes" what the code under test gets wrong | Plan 2 `toPlain` and the `user_id` mapper test |
| `test-asserts-the-mock` | A test whose only assertion is a value it set itself | general |

## 5. Definition of done and what counts as evidence

- A task is done when `npm run check:task` passes and its full output is pasted in the report.
- A self-report is not evidence. "Tests pass" without the output does not count.
- A test counts only if it fails when the code is broken. Show it once: break the code (or open the rule), run the test, see it fail, restore.
- A flow a person uses also needs the run recorded as in [engineering.md](engineering.md) section 6.

## 6. The quality checks every task ends with

`check:task` runs these in order (built in Task 8 of the local-AI quality plan; the exact options are filled in then).

| Check | What it proves |
|---|---|
| `plan` | The task file has a tier, an Interfaces block and a complete Test plan block |
| `lint` | ESLint guardrails, `PERF:` comments and documentation links are clean |
| `typecheck` | Strict TypeScript compiles with no errors |
| `unit` | The unit layer passes |
| `layers` | Every other layer the task's Test plan names passes; a layer not named is reported as not required |
| `hygiene` | Every new test has a header comment, no test or assertion was lost against the base commit, nothing is skipped or focused |
| `quality` | Changed files stay within the function-length and complexity limits and contain no leftover debug output |
| `coverage` | Every case row of the Test plan points at a test that exists |
| `breaks` | Every listed deliberate break makes at least one named test fail, and the file is restored |
| `probes` | The unseen probes pass; a failure names only the row and the kind |

## 7. Learning loop

- Every miss a review or the developer finds is added to the catalogue (section 4), with where it was seen, in the same pull request that fixes it.
- If a tool could have caught it, the check is added to `check:task` (section 6) in that pull request too, or a follow-up is recorded in the roadmap.

## 8. Writing a probe

- **File:** `tests/probes/<plan>/<task>/<row>.probe.test.ts`.
- **Title:** `[<row id>] <kind>: <description>`, where `<kind>` is a slug from section 4 (lower case and hyphens only), for example `[C3] second-bad-item: two notes in one file`.
- **Sealed by norm:** a probe never reads the tests of the code under test (it is written from the Test plan and the catalogue), and the task prompt never names the probe folder. Review checks the session log for reads of it.

## 9. The per-task Test plan block

Every task file in a plan written under this standard carries a Test plan block (case table, probes, breaks, flow, evidence). Its format is described in [developer/test-plan-format.md](developer/test-plan-format.md) and checked by `npm run check:plan`.
