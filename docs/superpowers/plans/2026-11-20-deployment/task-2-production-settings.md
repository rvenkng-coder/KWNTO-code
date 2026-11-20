# Task 2: Production settings: rate limits and trusted proxy

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Checkpoint 2A tier:** local
**Depends on:** Task 1

Carried in from Plan 2: PocketBase's rate limiter must be on, because the sign-in lockout cannot stop guesses sent in parallel (security.md 3, "parallel guesses"), and PocketBase must trust the proxy's `X-Forwarded-For`, or every request comes from Caddy's IP and the per-IP lockout becomes per-account (security.md 3, "until the proxy is configured"). Both only in production (D8).

**Files:**
- Create: `backend/pb_hooks/lib/production-settings.js`, `tests/hooks/production-settings.unit.test.ts`, `backend/pb_migrations/1794390000_production_settings.js`, `tests/container/production.test.ts`, `tests/rules/production-settings.rules.test.ts`
- Modify: `backend/entrypoint.sh` (the D8 start check), `compose.edge-test.yaml` (a second profile-free way to start with `KWNTO_PRODUCTION=1`: `edgeUp({ KWNTO_PRODUCTION: '1', KWNTO_PUBLIC_URL: 'https://kwnto.example.ts.net' })` must work), `tests/container/container.test.ts` (one new test, nothing changed), `docs/developer/backend.md` ("Production settings"), `docs/security.md` (section 3: the rate limiter and trusted proxy are on in production, with the D7 values; the "parallel guesses" and "until the proxy is configured" gaps say how they are closed)

**Interfaces:**
- Consumes: `edgeUp`, `edgeDown`, `raw`, `EDGE_URL`, `EDGE_ADMIN_URL`, `edgeAdminToken`, `verifiedUser` (Task 1); `adminSend` (`tests/rules/helpers/pb.ts`).
- Produces, `lib/production-settings.js` (CommonJS):

```js
// Returns null unless env.KWNTO_PRODUCTION === "1". Throws Error("KWNTO_PUBLIC_URL must start with https://") otherwise when the URL is missing or not https.
function productionSettings(env) -> null | {
  meta: { appURL: string /* KWNTO_PUBLIC_URL without a trailing slash */, appName: "KWNTO" },
  rateLimits: { enabled: true, rules: [
    { label: "*:auth", maxRequests: 2, duration: 3 },
    { label: "/api/kwnto/teams/", maxRequests: 10, duration: 60 },
    { label: "/api/", maxRequests: 300, duration: 10 } ] },
  trustedProxy: { headers: ["X-Forwarded-For"], useLeftmostIP: false },
  backups: { cron: "0 2 * * *", cronMaxKeep: 7 },
}
module.exports = { productionSettings }
```

- Produces, the migration: reads `$os.getenv` for both names, calls `productionSettings`, and if not null assigns each value onto `app.settings()` and saves it (`app.save(settings)`). The down migration does nothing (settings edited by the admin are not reverted).

**If interrupted:** `docker compose -f compose.prod.yaml -f compose.edge-test.yaml down -v`; nothing else persists.

## Sized for the local model
**May touch:** `backend/pb_hooks/lib/production-settings.js`, `tests/hooks/production-settings.unit.test.ts` (exhaustive: no other file)
**Must not change:** the signature and return shape of `productionSettings` above, and every existing test
Stop and report if you need to touch anything else.
**Model server:** run `npm run ping:model` first; if it says NOT answering, do not start the run (see [the runbook](../../../developer/local-model-runbook.md))
**Checkpoint given:** Checkpoint 2A only

## Checkpoint 2A: The settings function

- [x] **Step 1: Write the failing test** C1 in `tests/hooks/production-settings.unit.test.ts` (load with `createRequire`, as `tests/hooks/retention.unit.test.ts` does).
- [x] **Step 2: Run** `npx vitest run --project unit tests/hooks/production-settings.unit.test.ts`. Expected: FAIL (module missing).
- [x] **Step 3: Implement** `productionSettings`. The flag test is the line `if (env.KWNTO_PRODUCTION !== "1") return null` (B1); the URL test is `if (!/^https:\/\/[^\s/]+/.test(url))` (B2).
- [x] **Step 4: Run** it. Expected: PASS. **Close checkpoint 2A** (commit `feat: production settings values`).

## Checkpoint 2B: The migration and the proofs

- [x] **Step 5: Confirm the settings API** in 0.40.6: in the dev container, `grep -n "RateLimits\|TrustedProxy\|UseLeftmostIP\|BackupsConfig\|CronMaxKeep" /pb/pb_data/types.d.ts`. Write the exact JS property names in the `progress.md` row; if any differs from the shape above, keep the shape in the lib and map it in the migration.
- [x] **Step 6: Write the failing tests** C2 (rules), C3 (container, in `container.test.ts`), C4 to C6 (container, `production.test.ts`; one `edgeUp` with production env in `beforeAll`).
- [x] **Step 7: Run** `npm run test:rules -- tests/rules/production-settings.rules.test.ts` and `npx vitest run --project container tests/container/production.test.ts`. Expected: C2 passes already (nothing is written yet, which is its point; say so), C3 to C6 FAIL.
- [x] **Step 8: Write the migration and the entrypoint check.** The shell check: when `KWNTO_PRODUCTION` is `1` and `KWNTO_PUBLIC_URL` does not start with `https://`, print `KWNTO_PUBLIC_URL must be set when KWNTO_PRODUCTION=1` to stderr and exit 64.
- [x] **Step 9: Run** both suites and `npm run test:rules`, `npm run test:e2e`. Expected: PASS with no existing test changed (the dev and test backends must not rate-limit). Then set the migration's flag test to always true: C2 and the whole rules suite must fail (the rate limiter refuses the suite's parallel sign-ins); restore it and say so. Update `backend.md` and `security.md`. **Close checkpoint 2B** (commit `feat: rate limiter and trusted proxy in production`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | settings values | unit | `{}`; `{ KWNTO_PRODUCTION: 'true', KWNTO_PUBLIC_URL: 'https://a.ts.net' }`; `{ KWNTO_PRODUCTION: '1', KWNTO_PUBLIC_URL: 'https://a.ts.net/' }`; `'1'` with `http://a.ts.net`; `'1'` with no URL | `null`; `null`; the full object with `appURL` `https://a.ts.net` (no slash) and the D7 rules in order; throws `KWNTO_PUBLIC_URL must start with https://` (twice) | tests/hooks/production-settings.unit.test.ts :: production settings are only produced for KWNTO_PRODUCTION=1 with an https URL |
| C2 | dev and test backends untouched | rules | admin `GET /api/settings` on the test backend | `rateLimits.enabled` false, `trustedProxy.headers` empty, `backups.cron` empty | tests/rules/production-settings.rules.test.ts :: the test backend has no production settings |
| C3 | refuses production without a URL | container | `docker run` the image with the admin env and `KWNTO_PRODUCTION=1`, no URL | exit 64; stderr `KWNTO_PUBLIC_URL must be set when KWNTO_PRODUCTION=1` | tests/container/container.test.ts :: refuses production mode without a public https URL |
| C4 | parallel wrong passwords are limited | container | production edge stack; 20 wrong sign-ins for one verified user sent at once through `EDGE_URL` | at least 17 answers are 429; at most 3 `failure` entries for that email in `security_events` (admin read) | tests/container/production.test.ts :: parallel wrong passwords are rate limited behind the proxy |
| C5 | a spoofed X-Forwarded-For is ignored | container | through `EDGE_URL` from the test host: 3 wrong sign-ins with `X-Forwarded-For: 203.0.113.1`, 3.1 s apart (the auth limit); then the right password with `X-Forwarded-For: 203.0.113.2` | the 4th is 429 (lockout: the same real IP); the `failure` entries' `ip` is not `203.0.113.1` | tests/container/production.test.ts :: a client cannot choose its own IP with X-Forwarded-For |
| C6 | the trusted hop is believed | container | from a container at `172.30.0.2` on `kwnto-edge` (`docker run --network kwnto-edge --ip 172.30.0.2` with the image's `wget`): 3 wrong sign-ins with `X-Forwarded-For: 203.0.113.1`, 3.1 s apart; then the right password with `X-Forwarded-For: 203.0.113.2` | the 4th is 200; the `failure` entries' `ip` is `203.0.113.1` | tests/container/production.test.ts :: the address Tailscale forwards is the one the lockout counts |
### Probes
**Probe folder:** `tests/probes/2026-11-20-deployment/task-2/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | backend/pb_hooks/lib/production-settings.js | `if (env.KWNTO_PRODUCTION !== "1") return null` | `if (!env.KWNTO_PRODUCTION) return null` | tests/hooks/production-settings.unit.test.ts |
| B2 | backend/pb_hooks/lib/production-settings.js | `if (!/^https:\/\/[^\s/]+/.test(url))` | `if (!/^https?:\/\/[^\s/]+/.test(url))` | tests/hooks/production-settings.unit.test.ts |
### Flow
none
### Evidence
The full output of `npm run check:task`, the Step 5 findings, the Step 9 always-on run, and the failing run of each break.
