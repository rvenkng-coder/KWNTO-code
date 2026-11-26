# Task 10: CI checks and closeout

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** 9

**Files:**
- Modify: `.github/workflows/ci.yml`, `docs/developer/workflow.md`, `docs/superpowers/plans/README.md`, `docs/superpowers/plans/2026-11-26-maintainability/README.md`

**Interfaces:** none

**If interrupted:** nothing leaves state outside the working tree.

- [ ] **Step 1: In the CI `checks` job**, give `actions/checkout` `fetch-depth: 0` and add after the unit tests:

```yaml
      - if: github.event_name == 'pull_request'
        run: npm run check:hygiene -- --base "origin/$BASE_REF"
        env:
          BASE_REF: ${{ github.base_ref }}
      - run: npm run report:quality
```

- [ ] **Step 2: Update `workflow.md`** sections 2.5 and 5: CI runs formatting, hygiene and prints the quality report; `check:quality` is still yours to run.
- [ ] **Step 3: Run `npm test`.** Mark the tasks and the roadmap `awaiting developer review`. Commit `ci: check test hygiene on pull requests`.
- [ ] **Step 4: Open pull request D** (with the developer's approval to push) and read the `checks` job log: both new steps ran.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | Hygiene runs on a pull request | manual | pull request D | the step runs and passes |  |
| C2 | It refuses a bad test | manual | `npm run check:hygiene` with a `test.only` added, then removed | fails naming the file |  |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
Run the C2 command, then read the CI log of pull request D.
### Evidence
The CI log of both steps, the `npm test` summary and the `check:task` output.
