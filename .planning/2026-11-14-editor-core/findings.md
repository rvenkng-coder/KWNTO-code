# Findings: Editor core

Record anything unexpected here: behaviour that differs from what the plan assumed, and what was done about it.

## Task 4: join-code flake

- **Stress before the fix** (`e2e/accounts.spec.ts -g "wrong code and regenerate" --project=firefox --repeat-each=30`): `--workers=4` 1 of 30 failed; `--workers=8` 1 of 30 failed. Both failures were at line 56, page2's `form-error` check (`element(s) not found` after 5 s), so no CPU-load rerun was needed.
- **Cause: a late team list clears the join error** (catalogue kind `race-and-parallel`). `TeamsScreen` calls `useTeams.list()` when it mounts, twice under React StrictMode in dev. `list()` ended with `set({ teams, error: null })`. When the person types a code and presses Join before those first list responses come back, the join fails fast (404). `join()` sets `error`, then the list responses land and set it back to `null`. So the error **was rendered and then replaced**, not "never rendered".
- **Evidence** (trace of the failing 4-worker run, page2's network, monotonic ms): two `team_members` list GETs start at 17114.7 and 17118.4 and take 117 and 259 ms, so they finish at about 17231.7 and 17377.4. `POST /api/kwnto/teams/join` starts at 17220.6, answers 404 in 6 ms and finishes at about 17226.6, before both lists. The snapshot at failure shows the code still in the box (`setCode('')` runs only on success) and no alert. Page 1 does not hit this because `createTeam` waits for its list before the join.
- **The other candidate is ruled out:** the regenerate response is awaited by line 50 (`not.toHaveText(oldCode)`) before page2 is opened, and page 1's checks never failed.
- **Deterministic test:** `wrong code error survives a slow response` delays every `team_members` list response by 1 s with `page.route`. Before the fix it failed in both browsers at the second check (the error showed, then disappeared once the list landed).
- **Fix** (`frontend/src/features/teams/useTeams.ts`): `list()` no longer touches `error`; `create`, `remove` and `join` clear `error` (with `notice`) when they start, so a successful action still removes an old error as before. Side effect: a `Failed to load teams` error now stays until the next action or until the screen unmounts, rather than until the next successful list.
- **Stress after the fix:** `--workers=4` 0 of 30, `--workers=8` 0 of 30. At roughly 1 failure in 30 before, 0 in 60 alone is weak evidence (about a 13% chance even with no fix); the deterministic test is the proof. Full `npm run test:e2e`: 52 passed.
