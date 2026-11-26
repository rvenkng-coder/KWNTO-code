# Getting Started with KWNTO

## Prerequisites

- **Node 22** (see `.nvmrc`)
- **Docker** (for PocketBase container)
- **gitleaks** (for pre-commit secret scanning; [install](https://github.com/gitleaks/gitleaks))

## First Run

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and set credentials:

   ```bash
   cp .env.example .env
   # Edit .env: set KWNTO_ADMIN_EMAIL and KWNTO_ADMIN_PASSWORD (10+ characters)
   ```

3. Start the PocketBase backend:

   ```bash
   npm run dev:backend
   ```

4. In a second terminal, start the Vite dev server:

   ```bash
   npm run dev
   ```

The app is now running at <http://localhost:5173>.

## Formatting

Prettier sets the layout of every `.ts`, `.tsx` and `.js` file (line width 120, [decision 0006](../decisions/0006-formatter.md)). CI refuses a file that is not formatted.

- Turn on format on save with your editor's Prettier plugin; it reads `.prettierrc.json`.
- Or run `npm run format` before a commit. `npm run format:check` says which files differ. If it still names a file after one run, run `npm run format` again: a long method chain sometimes needs a second pass.
- Once per clone, hide the format-only commit from `git blame`: `git config blame.ignoreRevsFile .git-blame-ignore-revs`.

## npm Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Build the app for production (`tsc -b && vite build`) |
| `npm run typecheck` | Run TypeScript type checking (`tsc -b --noEmit`) |
| `npm run preview` | Preview the production build locally |
| `npm run dev:backend` | Start PocketBase in Docker (`docker compose -f compose.dev.yaml up --build`) |
| `npm run test:unit` | Run unit tests (Vitest, Node environment) |
| `npm run test:container` | Run container hardening tests (Docker) |
| `npm run test:rules` | Run PocketBase access rule tests (live PocketBase instance) |
| `npm run test:e2e` | Run end-to-end tests (Playwright, Firefox + Chromium) |
| `npm run test` | Run the full suite: `lint && typecheck && test:unit && test:container && test:rules && test:e2e` |
| `npm run lint` | Run ESLint, the PERF comment check, the docs link check, the plan check and the history-reference check |
| `npm run format` | Rewrite the layout of every code file with Prettier |
| `npm run format:check` | Fail if a code file is not formatted |
| `npm run check:docs` | Check that all relative markdown links resolve |
| `npm run check:comments` | Fail if a code comment cites a plan, task or case id |
| `npm run check:plan` | Check the task files of the plans |
| `npm run check:hygiene` | Check new tests have a header and no test was skipped or lost |
| `npm run check:quality` | Function length and complexity limits on changed files |
| `npm run spike:realtime` | Run the real-time spike (seed data, Playwright test, teardown) |
| `npm run prepare` | Set up the gitleaks pre-commit hook (`git config core.hooksPath .githooks`) |

## Next Steps

- Read the [design](../../docs/superpowers/specs/2026-11-11-kwnto-design.md) and [ERD](../../docs/superpowers/specs/2026-11-11-kwnto-erd.md) to understand the product.
- See [engineering.md](../engineering.md) for coding principles.
- See [testing.md](./testing.md) for test layer details.
- See [AGENTS.md](../../AGENTS.md) for repo layout and hard rules.

## Next

- [How it fits together](architecture.md): the running system and the code layers.
- [Maintaining it by hand](maintaining.md): commands, production, where to look when something breaks.
- [The development workflow](workflow.md): branch to production, how to write each kind of test, what each CI job needs, where the docs go.
