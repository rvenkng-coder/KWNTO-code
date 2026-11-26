# Lint and guardrail checks

`npm run lint` runs ESLint on the whole repo, then the PERF comment check. Both must pass before a change is done. Both are required by [engineering.md](../engineering.md); this page says what each one catches and how to fix it.

## What ESLint enforces

The rules in this table apply to `frontend/src/**/*.{ts,tsx}`. The config is `eslint.config.js`; the rule tests are `tests/lint/guardrails.test.ts`.

| Rule | What it catches | What to do |
|---|---|---|
| `max-lines` (300; test files 500) | A file over the limit, not counting blank lines and comments | Split it by feature or responsibility |
| `no-restricted-imports` | `import ... from 'pocketbase'` anywhere except `frontend/src/backend/`, `tests/rules/` and `e2e/` | Call the backend through a function in `frontend/src/backend/` |
| `@typescript-eslint/no-explicit-any` | The `any` type | Use a real type or `unknown`. If `any` is truly needed: `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <reason>` |
| `no-restricted-syntax` | The React prop `dangerouslySetInnerHTML` | Render text as text (security.md section 5) |

## Backend hooks

`backend/pb_hooks/**/*.js` is run by PocketBase and is not typechecked, so lint is its only static check: the recommended ESLint rules (an undefined name, an unused variable) and `max-lines` (300). The names PocketBase provides are listed in `POCKETBASE_GLOBALS` in `eslint.config.js`; add a name there only when PocketBase really provides it (`backend/pb_data/types.d.ts` in a running container lists them). A `catch (error)` whose `error` is unused is allowed.

ESLint skips `dist/`, `spike/`, `.agents/`, `.claude/` and the prototype `branching_narrative_tool.tsx`.

## The PERF comment check

Code that is compressed or tuned for speed must carry a comment that starts with `PERF:` and holds all three parts: `What:`, `Why:` and `Trade-off:` (engineering.md section 1). The check, `scripts/check-perf-comments.ts`, reads every `.ts` and `.tsx` file under `frontend/src/`. For each `PERF:` comment missing a part it prints `path:line PERF comment needs What:, Why: and Trade-off:` and exits with 1.

A comment is one `/* */` block, or a run of adjacent `//` lines. Either of these passes (the numbers are made up for the example):

```ts
// PERF: What: draws only the nodes inside the visible area.
// Why: 5,000 nodes took 180 ms per frame (measured with the profiler).
// Trade-off: nodes just off screen pop in when dragging fast.
```

```ts
/* PERF: What: ... Why: ... Trade-off: ... */
```

Two `PERF:` notes in one run of `//` lines are checked separately. The check works on the comment text only; it does not judge whether the content is true, so a reviewer still reads it.

## Comments that point at history

A comment states its reason where it is. A reference to a plan, task, case, finding or decision number sends the reader to old project history. `scripts/check-comment-refs.ts` reads the comments (not strings or text on screen) of the code under `frontend/src`, `backend/pb_hooks`, `e2e`, `tests` and `scripts`; probe files and migrations are left out. A design section or a decision record may be cited after the reason. It is not part of `npm run lint` yet: the old references are still being rewritten.

- `npm run check:comments` prints `file:line: reference` for each one and exits with 1. Add paths to check less: `npm run check:comments -- backend/pb_hooks`.
- `npm run check:comments -- --same-code <base>` lists each code file that differs from `<base>` in more than its comments, and each added, deleted or renamed one. Use it to prove that a comment rewrite changed no code. It cannot see a removed directive such as `eslint-disable` or `// Protects:`; lint and `check:hygiene` do.

## Commands

| Command | What it does |
|---|---|
| `npm run lint` | ESLint, then the PERF check |
| `npx eslint .` | ESLint only |
| `node scripts/check-perf-comments.ts` | PERF check only |
| `npm run test:unit` | Includes the tests for the rules above |

## Changing a rule

Never loosen a rule to make a change pass. Change the rule and its test in `tests/lint/guardrails.test.ts` together, and say why in the commit message.

## TypeScript version

TypeScript is pinned to `~6.0.3` because `typescript-eslint` does not yet accept 7.x. See [0001-toolchain.md](../decisions/0001-toolchain.md).
