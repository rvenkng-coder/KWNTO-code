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
| `npm run test` | Run the full suite: `lint && typecheck && test:unit && test:container && test:rules` |
| `npm run lint` | Run ESLint, PERF comment check, and docs link check |
| `npm run check:docs` | Check that all relative markdown links resolve |
| `npm run spike:realtime` | Run the real-time spike (seed data, Playwright test, teardown) |
| `npm run prepare` | Set up the gitleaks pre-commit hook (`git config core.hooksPath .githooks`) |

## Next Steps

- Read the [design](../specs/2026-11-11-kwnto-design.md) and [ERD](../specs/2026-11-11-kwnto-erd.md) to understand the product.
- See [engineering.md](../engineering.md) for coding principles.
- See [testing.md](./testing.md) for test layer details.
- See [AGENTS.md](../../AGENTS.md) for repo layout and hard rules.
