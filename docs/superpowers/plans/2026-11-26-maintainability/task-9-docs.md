# Task 9: Docs for people, agent material separated, recipes

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** 8

**Files:**
- Create: `docs/developer/recipes.md`
- Modify: `AGENTS.md`, `README.md`, `docs/README.md`, `docs/engineering.md`, `docs/security.md`, `docs/developer/getting-started.md`, `docs/developer/maintaining.md`, `docs/developer/workflow.md`, `docs/superpowers/plans/README.md`

**Interfaces:** none

**If interrupted:** nothing leaves state outside the working tree.

- [ ] **Step 1: Separate the agent material, deleting and moving nothing.**
  - `AGENTS.md`: first the rules, layout and commands everyone uses; then one section `Agent workflow only` holding `check:task`, `check:breaks`, `check:probes`, `prepare-local-run`, `ping:model`, the report commands, `.pi/`, `.claude/`, `.planning/` and tracking.
  - `docs/README.md`: two tables, `For people` and `Agent workflow`. Add the pages it omits (`architecture`, `maintaining`, `workflow`, `project-file`, `user/player`, decisions 0004 to 0006) and replace the plan rows with one link to the roadmap.
- [ ] **Step 2: Fix what is stale.**

| File | Change |
|---|---|
| `AGENTS.md` "To resume" | No branch name: use the worktree of the current plan's branch |
| `AGENTS.md` 300-line rule | Say where lint enforces it: `frontend/src` (tests 500) and `backend/pb_hooks` |
| `getting-started.md` scripts table | `npm test` includes e2e; add every check that `lint` runs; gitleaks stays a prerequisite |
| `engineering.md` section 7 | Branch, pull request, the developer reviews and merges |
| `engineering.md`, `security.md` "(planned)" | Remove only where you can name the file or CI step that does it; list the proof in the pull request; keep and report the rest |
| Roadmap section 7 heading | `done`, as in the table |

- [ ] **Step 3: Add to `engineering.md` section 2:** "Comments state the reason where they are. Never cite a plan, task, decision number, case id or finding. A design section or decision record may follow the reason. Checked by `npm run lint`."
- [ ] **Step 4: Write `recipes.md`** (linked from `maintaining.md`), each recipe a numbered list of files in the order to change them, with the command that fails if one is missed:
  1. Add a field to a node: migration; `content-types.ts`; `content-mappers.ts`; `model/fixtures.ts` and `canvas/newNode.ts`; `project-records.js`, `project-file-build.js`, `-validate.js`, `-plan.js`, `project-import.js`; `share-types.ts`; `shareModel.ts`; `tests/rules/helpers/file-contract.ts` and `carried.ts`; ERD and `project-file.md`.
  2. Add a collection (from `AGENTS.md`, "Adding a collection", plus the file contract).
  3. Add a backend service: its module in `frontend/src/backend/`, `client.ts`, one getter in `index.ts`, its unit test.
- [ ] **Step 5: Update `maintaining.md` and `workflow.md`:** formatting, the new checks, and "what you can ignore" matching step 1.
- [ ] **Step 6: Try recipe 1 on a throwaway branch:** add a node field to the migration only, follow the list, and fix any step that is missing or wrong. Discard the field.
- [ ] **Step 7: Run** `npm run lint`. Expected: PASS (links resolve). Commit `docs: guides for working by hand`.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | Links resolve | manual | `npm run lint` | pass |  |
| C2 | Recipe 1 is complete | manual | a new node field added by following it | `npm test` passes with no step outside the list |  |
| C3 | Every page is listed | manual | `docs/` against `docs/README.md` | none missing |  |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
The developer follows `maintaining.md` from a fresh clone to a running app and notes each stumble.
### Evidence
The proof list for removed "(planned)" marks, the result of step 6 and the `check:task` output.
