# Task 1: App scaffold and toolchain

Part of the [Foundation and Real-Time Spike plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** local-OK  
**Depends on:** none

**Files:**
- Create: `package.json`, `.nvmrc`, `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/index.css`, `frontend/src/smoke.test.ts`, `.env.example`, `docs/decisions/0001-toolchain.md`
- Modify: `.gitignore`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `typecheck`, `test:unit`; Vitest projects named `unit`, `rules`, `container` (the last two get their tests in Tasks 2 and 5); Vite dev proxy of `/api` and `/_` to `process.env.KWNTO_PB_URL ?? 'http://127.0.0.1:8090'`.

**If interrupted** (see the router, "Surviving interruptions"):
- `npm install` and `npx playwright install` are safe to run again; run them again if `npm ls --depth=0` reports anything missing.
- If the temporary scaffold folder still exists, Step 1 did not finish: delete nothing, compare it with the repo root, and move across only the files that are missing.
- This is the only task besides 2A that needs the internet. If offline, stop and say so; no later task can start without 1A.


## Checkpoint 1A: Scaffold and install (needs network)

- [ ] **Step 1: Scaffold.** Generate the Vite `react-ts` template into a temporary folder and move its files to the repo root (the root is not empty, so do not scaffold in place). Set the package name to `kwnto`, `"private": true`. Do not hand-pin versions: let the template choose a TypeScript and ESLint pair that install without peer-dependency errors.
- [ ] **Step 2: Install** the remaining approved dependencies: `tailwindcss @tailwindcss/vite zustand @xyflow/react pocketbase` and dev `vitest @playwright/test`. Then `npx playwright install firefox chromium`.
- [ ] **Step 3: `.gitignore`** adds `node_modules/`, `dist/`, `.env`, `test-results/`, `playwright-report/`, `spike/realtime/results/`. Do this before the first commit so `node_modules/` is never staged.
- [ ] **Close checkpoint 1A.** Verify: `npm ls --depth=0` exits 0, and `git status --short` lists no path under `node_modules/`. Commit: `chore: scaffold from the Vite template and install dependencies`.

## Checkpoint 1B: Configure and prove the toolchain

- [ ] **Step 4: Configure.** `tsconfig`: `"strict": true`, `"noUncheckedIndexedAccess": true`, `"allowImportingTsExtensions": true`. `vite.config.ts`: React and Tailwind plugins and the proxy above. `frontend/src/index.css`: `@import "tailwindcss";`. `vitest.config.ts`: three projects, all `environment: 'node'`:

| Project | Include | Notes |
|---|---|---|
| `unit` | `frontend/src/**/*.test.{ts,tsx}`, `scripts/**/*.test.ts`, `tests/lint/**/*.test.ts` | |
| `rules` | `tests/rules/**/*.test.ts` | `globalSetup: tests/rules/global-setup.ts` (Task 5) |
| `container` | `tests/container/**/*.test.ts` | `testTimeout: 180_000`, files run in sequence |
- [ ] **Step 5: Replace the template page.** `frontend/src/App.tsx` renders only `<h1>KWNTO</h1>`. Delete the template's logos and demo CSS.
- [ ] **Step 6: Write the smoke test** `frontend/src/smoke.test.ts`:

```ts
// Protects: the unit-test runner itself. If this fails, no other unit result can be trusted.
import { expect, test } from 'vitest'
test('vitest runs TypeScript', () => {
  const total: number = [1, 2, 3].reduce((sum, n) => sum + n, 0)
  expect(total).toBe(6)
})
```
- [ ] **Step 7: Scripts.** `dev`: `vite`. `build`: `tsc -b && vite build`. `typecheck`: `tsc -b --noEmit`. `test:unit`: `vitest run --project unit`.
- [ ] **Close checkpoint 1B.** Verify: `npm run typecheck && npm run test:unit && npm run build` gives no type errors, `1 passed`, and a `dist/` folder. Commit: `chore: configure TypeScript, Vite, Tailwind and Vitest`.

## Checkpoint 1C: Record the decisions

- [ ] **Step 8: `.env.example`** contains `KWNTO_ADMIN_EMAIL=` and `KWNTO_ADMIN_PASSWORD=` with a comment that the password must be 10 or more characters.
- [ ] **Step 9: Write `docs/decisions/0001-toolchain.md`:** each dependency from "Dependencies approved by this plan", its installed version, licence, and one line on why. Note the single-package layout and same-origin backend URL.
- [ ] **Close checkpoint 1C.** Verify: both files exist and `docs/decisions/0001-toolchain.md` lists every dependency in `package.json`. Commit: `docs: toolchain decision record and .env.example`.
