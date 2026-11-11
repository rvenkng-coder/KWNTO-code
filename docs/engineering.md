# KWNTO Engineering Principles

How we write code here, and why. For what the product does, see the [design](superpowers/specs/2026-11-11-kwnto-design.md). For security rules, see [security.md](security.md). Where a rule is enforced by a tool, the tool is named. A rule with no tool is a promise, so please keep it.

These principles were set by the developer on 2026-11-11. Items marked **(planned)** are to be set up in the first plan tasks and do not exist yet.

## 1. Readable beats clever

- Write code to be understood, not to be short. No dense one-liners, even with a comment explaining them. If the logic is hard to read, it is too compressed.
- **Exception: performance.** Compressed or optimized code is allowed only where speed really matters (for example, canvas drawing and dragging on a large map). It must carry a comment with all three parts:
  1. **What:** what the code does, step by step, in plain terms.
  2. **Why:** why it is written this way (what was too slow, ideally with a measurement).
  3. **Trade-off:** what we gave up (readability, memory, flexibility).

  Mark it with `PERF:` at the start of the comment so it can be found and reviewed. **(planned: a pull-request check looks for `PERF:` comments without all three parts)**

## 2. Clean structure

- **One function does one thing.** If you need "and" to describe it, split it.
- **One module owns one feature.** Group files by feature, not by technical layer.
- **Data flow is easy to track.** A reader should be able to follow where a value comes from and where it goes. Prefer passing values in and returning values out over hidden shared state.
- **Small files.** Split modules into small components and files. Target 300 lines or fewer per file. Enforced by ESLint `max-lines` (blank lines and comments do not count).
- **One door to the backend.** Only the backend module talks to PocketBase. Nothing else imports it. This also keeps the backend swappable (see design section 7). Enforced by ESLint `no-restricted-imports`.
- **Strict TypeScript.** No `any` without a comment explaining why. Enforced by `tsc --strict` (`npm run typecheck`) and the ESLint rule `@typescript-eslint/no-explicit-any`.
- Comments explain **why**, not what. If a comment explains what the code does, the code should be clearer instead (except for `PERF:` comments above).

## 3. Change only what the task needs

- Do not change working code without a reason. An agent or developer sees something to improve: report it, do not fix it silently.
- **Every change to existing code is explained in three places:**
  - **Commit message:** what changed and why.
  - **Pull-request description:** summary, what was tested, any risk.
  - **Inline comment:** the reason, where the code looks odd or non-obvious.
  
  New code can be shorter on explanation. Changed code cannot.
- **Refactors and behavior changes go in separate commits.**
- **Never edit a failing test to make it pass.** If a change breaks a passing test, stop and explain why, then decide with the developer whether the code or the test is wrong.

## 4. Dependencies

- Never add a dependency on your own. Stop and give the developer the realistic options with pros, cons, licence, maintenance status and size, plus a recommendation. The developer decides.
- Everything must be free to use and run (project rule: zero cost).
- Record each decision, with its reason, in `docs/decisions/` **(planned)**.

## 5. Ask first

An agent must always ask the developer before:
- pushing to GitHub or any remote;
- deleting data, files or database records;
- changing a migration that has already run;
- touching the server, VM or Docker volumes;
- deleting git branches or rewriting git history;
- force-pushing, resetting, or discarding uncommitted work.

Everything else stays inside the task you were given.

## 6. Evidence that work is done

| Task | Evidence required |
|---|---|
| A function or a single module | Unit tests pass. |
| Several modules together, or a full user flow | Run the app, try the feature as a user would, and record what you did and saw (in the pull request or the progress notes). A screenshot is optional. |

- **Tests are documented.** Each test says what behavior it protects and why it exists. A passing test with no description, or "it works" with no record, is not evidence.
- Test layers and priorities are in the design, section 8b. Write the test first where the logic is pure.

## 7. Git workflow

- Work on a short-lived branch in small commits. **The developer reviews before anything lands on `main`. Agents never merge to `main` themselves.**
- Today (deadline pressure): branch, review, then `main` in small steps, without a pull request.
- Target: one branch per feature, merged through a pull request the developer reviews.
- The GitHub workflow runs the tests and the documentation check on every push **(planned)**.

## 8. Documentation is part of done

Every feature, setting and script is documented in `docs/` (user manual, admin and deployment guide, developer notes). Nothing ships undocumented. A pull-request checklist requires the docs update **(planned)**.

## 9. Project-specific rules (from the design)

- **Save per attribute.** Each editable thing (node title, color, position, each script line, cue, connection) is its own field or record, so edits do not clobber each other. Positions save when a drag ends, not continuously.
- **Edits are written locally first, then synced** (offline resilience, design section 6.7). Never discard a queued edit; on conflict, ask the user which version to keep.
- **Settings live in the settings tables**, not in code. Limits and timings are admin-editable (design section 7c).
- **No code that needs a paid service.**
- **The prototype (`branching_narrative_tool.tsx`) is reference only.** Do not copy code from it.
