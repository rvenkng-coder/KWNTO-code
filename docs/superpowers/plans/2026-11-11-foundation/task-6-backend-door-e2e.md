# Task 6: The backend door and the end-to-end harness

Part of the [Foundation and Real-Time Spike plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid  
**Depends on:** Task 1 and Task 5

**Files:**
- Create: `src/backend/client.ts`, `src/backend/index.ts`, `src/backend/client.test.ts`, `playwright.config.ts`, `e2e/smoke.spec.ts`
- Modify: `src/App.tsx`, `package.json`, `docs/developer/testing.md`

**Interfaces:**
- Consumes: `scripts/with-pocketbase.ts` (Task 5); the Vite proxy (Task 1).
- Produces, from `src/backend/index.ts` (the only import path the rest of the app uses; later plans add methods here):

```ts
export interface Backend { health(): Promise<boolean> }
export function createBackend(baseUrl?: string): Backend   // default '/', same origin
export const backend: Backend
```

**If interrupted** (see the router, "Surviving interruptions"):
- A killed Playwright run can leave Vite listening on port `5174`; the next run then fails at once because of `--strictPort`. Find it with `lsof -i :5174` and stop that one process.
- The test container is cleaned by `scripts/with-pocketbase.ts` on the next run.

## Checkpoint 6A: The backend module

- [x] **Step 1: Write the failing unit test** `src/backend/client.test.ts`:

```ts
// Protects design 6.7: an unreachable backend is a normal state the UI reports, never a crash.
test('health() resolves false when the backend is unreachable', async () => {
  await expect(createBackend('http://127.0.0.1:1').health()).resolves.toBe(false)
})
```

- [x] **Step 2: Run** `npm run test:unit`. Expected: FAIL (`createBackend` not defined).
- [x] **Step 3: Implement** `src/backend/client.ts` (wraps one `PocketBase` instance; `health()` uses the SDK's health check and returns `false` on any error) and `src/backend/index.ts` (re-exports). Run `npm run test:unit`. Expected: PASS.
- [x] **Close checkpoint 6A.** Verify: `npm run test:unit` passes with the new test and `npm run lint` is clean. Commit: `feat: backend module with health check`.

## Checkpoint 6B: End-to-end harness and status line

- [x] **Step 4: Write the failing end-to-end test** `e2e/smoke.spec.ts`:

```ts
// Protects: the whole chain browser -> Vite proxy -> PocketBase, in both supported browsers.
test('the app loads and reaches the backend', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'KWNTO' })).toBeVisible()
  await expect(page.getByTestId('backend-status')).toHaveText('Backend: connected')
})
```

- [x] **Step 5: `playwright.config.ts`:** `testDir: 'e2e'`; projects `chromium` and `firefox`; `baseURL: 'http://localhost:5174'`; `webServer: { command: 'npm run dev -- --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: false }` (it inherits `KWNTO_PB_URL` from `with-pocketbase`). Script `test:e2e`: `node scripts/with-pocketbase.ts playwright test`. Append `&& npm run test:e2e` to `test`.
- [x] **Step 6: Run** `npm run test:e2e`. Expected: FAIL in both browsers (no `backend-status` element).
- [x] **Step 7: Edit `src/App.tsx`:** on mount call `backend.health()` and render `<p data-testid="backend-status">` with `Backend: checking…`, then `Backend: connected` or `Backend: unreachable`.
- [x] **Step 8: Run** `npm test`. Expected: every layer passes; end-to-end shows `2 passed`. Record in `progress.md` that you also opened `npm run dev` with `npm run dev:backend` running and saw "Backend: connected" (engineering.md section 6).
- [x] **Step 9: Add the end-to-end layer** to `docs/developer/testing.md`.
- [x] **Close checkpoint 6B.** Verify: Step 8 passed (`npm test`, end-to-end `2 passed`). Commit: `feat: end-to-end harness and backend status line`.
