# Task 7: Rewrite comments: frontend

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** 5

**Files:**
- Modify: every file `npm run check:comments -- frontend/src` lists (about 206 lines in 121 files; start with `features/editor/store` and `sync`, measured before formatting)

**Interfaces:**
- Consumes: `npm run check:comments [-- <path>...]` and `-- --same-code <base>`

**If interrupted:** commit the finished files; the check lists what is left.

## How to rewrite one comment

1. Open the cited plan, decision table or finding and learn what it asks for.
2. Say that reason in the comment, in plain words, so nobody has to open it.
3. If the comment only names a source and the code is clear, delete it.
4. If the code and the cited text disagree, leave both and report it.
5. Change comments only. Keep every `// Protects:` header, `PERF:` block, `eslint-disable` and `/// <reference` line.

| Before | After |
|---|---|
| `// The sender merges waiting edits (D5).` | `// Only the sending tab merges waiting edits: another tab cannot know what is on the wire.` |
| `// The search box of Task 13, when it is on the page.` | `// The search box, when it is on the page.` |

- [ ] **Step 1: List** with `npm run check:comments -- frontend/src` and note the count.
- [ ] **Step 2: Rewrite** one folder at a time, one commit per folder (`docs: explain comments in <folder>`).
- [ ] **Step 3: Verify:** `npm run check:comments -- frontend/src` reports nothing; `npm run check:comments -- --same-code <base>` reports nothing; `npm run format:check`, `npm run lint`, `npm run check:hygiene -- --base <base>` pass.
- [ ] **Step 4: Run** `npm run test:unit` and `npm run test:e2e`. Expected: PASS.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | No history reference is left | manual | `check:comments -- frontend/src` | exit 0 |  |
| C2 | No code changed | manual | `check:comments -- --same-code <base>` | exit 0 (checkpoint 8B excepted) |  |
| C3 | Five rewritten comments, picked by the developer, make sense without the plans | manual | the diff | accepted |  |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
Run steps 3 and 4; the developer reads five rewritten comments.
### Evidence
Both check outputs, the step 4 summaries, any disagreement found, and the `check:task` output.
