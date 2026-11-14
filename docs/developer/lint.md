# Lint and guardrail checks

`npm run lint` runs ESLint on the whole repo, then the PERF comment check. Both must pass before a change is done. Both are required by [engineering.md](../engineering.md); this page says what each one catches and how to fix it.

## What ESLint enforces

Rules apply to `frontend/src/**/*.{ts,tsx}`. The config is `eslint.config.js`; the rule tests are `tests/lint/guardrails.test.ts`.

| Rule | What it catches | What to do |
|---|---|---|
| `max-lines` (300) | A file over 300 lines, not counting blank lines and comments | Split it by feature or responsibility |
| `no-restricted-imports` | `import ... from 'pocketbase'` anywhere except `frontend/src/backend/`, `tests/rules/` and `e2e/` | Call the backend through a function in `frontend/src/backend/` |
| `@typescript-eslint/no-explicit-any` | The `any` type | Use a real type or `unknown`. If `any` is truly needed: `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <reason>` |
| `no-restricted-syntax` | The React prop `dangerouslySetInnerHTML` | Render text as text (security.md section 5) |

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
