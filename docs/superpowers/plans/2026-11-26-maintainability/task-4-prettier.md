# Task 4: Prettier and the format-only commit

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** 3, and pull request A merged

**Files:**
- Create: `.prettierrc.json`, `.prettierignore`, `.git-blame-ignore-revs`, `docs/decisions/0006-formatter.md`
- Modify: `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `docs/developer/getting-started.md`, `e2e/teams-detail.spec.ts`, and every file Prettier rewrites

**Interfaces:**
- Produces: `npm run format` and `npm run format:check`

**If interrupted:** discard with the developer's approval and repeat from step 3; the format commit is reproducible.

- [ ] **Step 1: List unmerged branches** (`git branch -a --no-merged origin/main`) and wait for the developer to say each is finished, abandoned or willing to take conflicts.
- [ ] **Step 2: Install** `npm install --save-dev --save-exact prettier@3.10.1`. Write `0006-formatter.md` in the shape of `0005-export-libraries.md`: MIT, no dependencies, used for layout only, alternatives (Biome, dprint, ESLint Stylistic, `max-len`), how to bump (new version, `npm run format` in the same pull request).
- [ ] **Step 3: Configure.** `.prettierrc.json`:

```json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 120,
  "overrides": [{ "files": "backend/pb_hooks/**/*.js", "options": { "singleQuote": false } }]
}
```

  `.prettierignore`, one per line: `dist`, `node_modules`, `branching_narrative_tool.tsx`, `spike`, `backend/pb_migrations`, `tests/probes`, `.planning`, `.pi`, `.claude`. Scripts: `"format": "prettier --write \"**/*.{ts,tsx,js}\""`, `"format:check": "prettier --check \"**/*.{ts,tsx,js}\""`. Commit `chore: add Prettier (decision 0006)`.
- [ ] **Step 4: Run `npm run format`.** Expected: about 400 files, about +10,000 and -3,200 lines. Add the missing `// Protects:` comment above the first test of `e2e/teams-detail.spec.ts` (formatting makes the hygiene check see that old gap). Apart from that one comment the commit holds only Prettier's output: `style: format the code with Prettier`.
- [ ] **Step 5: Verify:** `npm test` (all layers, both browsers), `npx vitest run --project probes`, `npm run check:hygiene -- --base HEAD~1`. Expected: PASS. A failing test is not edited: stop and report it.
- [ ] **Step 6: Record the commit** in `.git-blame-ignore-revs` (a `#` line saying why, then the full SHA of step 4).
- [ ] **Step 7: Add `- run: npm run format:check`** after `npm run lint` in the CI `checks` job, and to `getting-started.md`: format on save (the editor's Prettier plugin), the two commands, and `git config blame.ignoreRevsFile .git-blame-ignore-revs`. Commit `chore: check formatting in CI`.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | Formatting changes no behaviour | manual | `npm test` after the format commit | all pass |  |
| C2 | Migrations are untouched | manual | `git diff --stat <base> -- backend/pb_migrations` | empty |  |
| C3 | Unformatted code is refused | manual | a long line added, then removed | `npm run format:check` fails and names the file |  |
| C4 | The format is stable | manual | `npm run format` twice | no second change |  |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
Open a project, edit a node, open a view link and play it; the words on screen are as before.
### Evidence
The branch list and answer, the `git diff --shortstat` of the format commit, the step 5 summaries and the `check:task` output.
