# Task 3: Auth store listeners

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** local
**Depends on:** none

Carried over from Plan 2 ("Auth store listeners"): `backend.auth.onChange` holds one listener (a second silently replaces the first), and a sign-in or sign-out in another tab is not noticed. The editor (Task 8) adds a second listener, so this must be fixed first. Files under `frontend/src/backend/` are always reviewed when built locally ([review sampling](../../../developer/review-sampling.md)).

**Files:**
- Modify: `frontend/src/backend/auth.ts`, `frontend/src/backend/auth.test.ts` (add tests only; existing tests unchanged), `docs/developer/backend.md`

**Interfaces:**
- Consumes: `pb.authStore.onChange(callback: (token: string, record: unknown) => void, fireImmediately?: boolean): () => void` from the SDK. The SDK's `LocalAuthStore` already fires `onChange` when another tab changes the stored session (`storage` event), so every store change must reach every listener.
- Produces (signature unchanged): `onChange(listener: (user: AuthUser | null) => void): () => void`. Now: any number of listeners; each is told on **every** store change (sign-in, refresh, sign-out, another tab), once per change, with the mapped user or `null`; the returned function removes only that listener; removing it twice is harmless; a listener that throws does not stop the others.
- `signIn` and `refresh` no longer call listeners themselves (the store's change does), so a listener hears a sign-in exactly once.

**If interrupted:** nothing leaves state outside the working tree.

## Sized for the local model
**May touch:** `frontend/src/backend/auth.ts`, `frontend/src/backend/auth.test.ts` (append only), `docs/developer/backend.md` (exhaustive: no other file)
**Must not change:** the exported names and signatures of `createAuth` and its methods, and every existing test in `auth.test.ts`
Stop and report if you need to touch anything else.
**Model server:** run `npm run ping:model` first; if it says NOT answering, do not start the run (see [the runbook](../../../developer/local-model-runbook.md))
**Checkpoint given:** Checkpoint 3A only

## Checkpoint 3A: A set of listeners fed by the store

- [ ] **Step 1: Write the failing tests** C1 to C6 in `frontend/src/backend/auth.test.ts`. Use a fake `pb` whose `authStore.onChange` records the callback so the test can fire it (`fire(token, record)`), as a store change from another tab would.
- [ ] **Step 2: Run** `npx vitest run --project unit frontend/src/backend/auth.test.ts`. Expected: the new tests FAIL, the old ones pass.
- [ ] **Step 3: Implement.** Keep listeners in `const listeners = new Set<(user: AuthUser | null) => void>()`; `onChange(listener)` runs `listeners.add(listener)` and returns `() => { listeners.delete(listener) }` (breaks B1 and B2 target these two lines, so keep the names). The one `pb.authStore.onChange` callback updates `cached` and calls each listener inside its own `try`/`catch`. Remove the direct `listener?.(...)` calls from `signIn` and `refresh`.
- [ ] **Step 4: Run** `npm run test:unit` and `npm run test:e2e`. Expected: PASS (the sign-in, refresh and sign-out flows of Plan 2 still work).
- [ ] **Step 5: Document** the listener contract in `docs/developer/backend.md`. **Close checkpoint 3A** (commit `fix: auth change listeners are a set fed by the store`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | two listeners both hear a change | unit | two `onChange` listeners; store fires a record | both called once with the mapped user | frontend/src/backend/auth.test.ts :: every listener hears a store change |
| C2 | unsubscribe removes only that listener | unit | remove the first; fire `null` | first not called, second called with `null`; calling remove twice does not throw | frontend/src/backend/auth.test.ts :: unsubscribing removes only that listener |
| C3 | another tab signs out | unit | store fires `('', null)` without `signOut()` being called | listeners get `null`; `current()` is `null` | frontend/src/backend/auth.test.ts :: a sign-out in another tab reaches the listeners |
| C4 | another tab signs in as someone else | unit | store fires a record with a different id | listeners get the new user; `current().id` is the new id | frontend/src/backend/auth.test.ts :: a sign-in in another tab replaces the cached user |
| C5 | sign-in heard exactly once | unit | `signIn` resolves and the store fires once | each listener called once | frontend/src/backend/auth.test.ts :: a sign-in reaches each listener once |
| C6 | a throwing listener does not stop the rest | unit | first listener throws | second still called | frontend/src/backend/auth.test.ts :: a failing listener does not silence the others |
### Probes
**Probe folder:** `tests/probes/2026-11-14-editor-core/task-3/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/backend/auth.ts | `listeners.delete(listener)` | `listeners.clear()` | frontend/src/backend/auth.test.ts |
| B2 | frontend/src/backend/auth.ts | `listeners.add(listener)` | `listeners.clear(); listeners.add(listener)` | frontend/src/backend/auth.test.ts |
### Flow
none
### Evidence
The full output of `npm run check:task` and the failing run of each break.
