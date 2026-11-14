# Task 1: App shell, theme and routes

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Checkpoint 1A tier:** local
**Depends on:** none

Carried over from Plan 2 ("App shell and styling"): the app is unstyled HTML. This task fixes the look once (decision D1), adds the hash routes (D2) and the theme toggle saved to the account (design 6.6, 7c `user_preferences`), and restyles the sign-in, sign-up and team screens, including the 390 px phone width.

**Files:**
- Create: `frontend/src/features/shell/routes.ts`, `frontend/src/features/shell/routes.test.ts`, `frontend/src/features/shell/useRoute.ts`, `frontend/src/features/shell/AppShell.tsx`, `frontend/src/features/shell/TopBar.tsx`, `frontend/src/features/shell/ThemeToggle.tsx`, `frontend/src/features/shell/theme.ts`, `frontend/src/backend/preferences.ts`, `frontend/src/backend/preferences.test.ts`, `e2e/shell.spec.ts`, `docs/developer/styling.md`
- Modify: `frontend/src/index.css`, `frontend/src/App.tsx`, `frontend/src/backend/client.ts`, `frontend/src/backend/index.ts`, `frontend/src/backend/types.ts`, every file in `frontend/src/features/auth/` and `frontend/src/features/teams/` (class names only, no behaviour change), `docs/user/accounts-and-teams.md`, `docs/README.md`

**Interfaces:**
- Produces, `frontend/src/features/shell/routes.ts`:

```ts
export type Route =
  | { name: 'teams' }
  | { name: 'team'; teamId: string }
  | { name: 'project'; projectId: string; chapterId: string | null }
export function parseRoute(hash: string): Route   // never throws; anything not understood is { name: 'teams' }
export function routeToHash(route: Route): string // '#/', '#/team/<id>', '#/project/<id>', '#/project/<id>/chapter/<id>'
```

- Produces, `frontend/src/features/shell/useRoute.ts`: `useRoute(): Route` (re-renders on `hashchange`) and `navigate(route: Route): void` (sets `location.hash`).
- Produces, `frontend/src/features/shell/theme.ts`: `applyTheme(theme: 'light' | 'dark'): void` (sets `document.documentElement.dataset.theme`).
- Produces, `frontend/src/backend/types.ts`: `export interface Preferences { theme: 'light' | 'dark'; minimapVisible: boolean }`
- Produces, on `Backend`: `backend.preferences: { get(): Promise<Preferences>; set(changes: Partial<Preferences>): Promise<Preferences> }` (reads and updates the signed-in user's own `user_preferences` row; rejects with `BackendError` like the rest of the door).
- Produces: `AppShell` (`{ children: ReactNode }`) with the top bar (product name, a `search` slot filled by Task 13, `ThemeToggle`, the signed-in name and "Sign out"); CSS tokens and shared classes of decision D1, documented in `docs/developer/styling.md`.

**If interrupted:** nothing leaves state outside the working tree.

## Sized for the local model
**May touch:** `frontend/src/features/shell/routes.ts`, `frontend/src/features/shell/routes.test.ts` (exhaustive: no other file)
**Must not change:** the `Route` type and the signatures of `parseRoute` and `routeToHash` above
Stop and report if you need to touch anything else.
**Model server:** run `npm run ping:model` first; if it says NOT answering, do not start the run (see [the runbook](../../../developer/local-model-runbook.md))
**Checkpoint given:** Checkpoint 1A only

## Checkpoint 1A: Hash routes (local)

- [x] **Step 1: Write the failing tests** in `frontend/src/features/shell/routes.test.ts` with the titles in the Cases table (C1 to C7). An id is valid only if it is exactly 15 characters from `a-z0-9` (PocketBase ids). Use `abcdefghijk0123` and `zyxwvutsrq98765` as valid ids.
- [x] **Step 2: Run** `npx vitest run --project unit frontend/src/features/shell/routes.test.ts`. Expected: FAIL (module not found).
- [x] **Step 3: Implement `parseRoute` and `routeToHash`.** Check ids with the constant `const ID = /^[a-z0-9]{15}$/` (break B1 targets it). Split the hash after `#/` on `/`, drop one trailing empty segment.
- [x] **Step 4: Run** the same command. Expected: PASS. **Close checkpoint 1A** (commit `feat: hash routes`).

## Checkpoint 1B: Tokens, shell and restyled screens

- [ ] **Step 5: Write `index.css`** with the D1 tokens for `:root` (light: white panels, soft shadow) and `[data-theme="dark"]` (flat solid dark panels, thin borders, no shadow), `@theme inline` mapping (`--color-*`, `--radius-*`), the shared classes, and the dot-grid background variable `--canvas-dot` used later by the canvas. No blur, no transparency on panels (design 6.6).
- [ ] **Step 6: Write `AppShell`, `TopBar`, `theme.ts`, `useRoute`;** `App.tsx` renders `AuthScreen` when signed out and otherwise `AppShell` around the screen for the current route (`teams` shows `TeamsScreen`; `team` shows `TeamDetail` for `teamId`, replacing `TeamsScreen`'s `selectedTeam` state with `navigate`, and Back goes to `#/`; `project` shows the text `Editor arrives in Task 9.` for now). Keep `data-testid="backend-status"` and `data-testid="session-user"`.
- [ ] **Step 7: Restyle** the auth and teams screens with the shared classes and Tailwind utilities on tokens. Forms are one column, `max-w-sm w-full`, inputs `w-full`, so nothing is cut at 390 px. Do not change text, labels, roles or test ids.
- [ ] **Step 8: Write `e2e/shell.spec.ts`** cases C9 and C10, then run `npm run test:e2e`. Expected: PASS, and every existing e2e test still passes.
- [ ] **Step 9: Write `docs/developer/styling.md`** (tokens, shared classes, how to add a colour, the no-hex rule from the router) and link it from `docs/README.md`. **Close checkpoint 1B** (commit `feat: app shell and theme tokens`).

## Checkpoint 1C: Theme toggle saved to the account

- [ ] **Step 10: Write the failing tests** `frontend/src/backend/preferences.test.ts` (C8, with a fake `pb` as in `auth.test.ts`) and add C11 to `e2e/shell.spec.ts`.
- [ ] **Step 11: Run** `npm run test:unit`. Expected: C8 FAILS.
- [ ] **Step 12: Implement `preferences.ts`** (`createPreferences(pb)`: the row is found with `pb.filter('user = {:user}', ...)`; `set` maps `minimapVisible` to `minimap_visible` and sends only the given keys) and wire it into `createBackend` and `index.ts`. `ThemeToggle` calls `applyTheme` at once, then `backend.preferences.set({ theme })`; on sign-in the shell loads the preference and applies it. Signed out, the theme follows `prefers-color-scheme`.
- [ ] **Step 13: Run** `npm run test:unit` and `npm run test:e2e`. Expected: PASS. Add one paragraph on the theme toggle to `docs/user/accounts-and-teams.md`. **Close checkpoint 1C** (commit `feat: theme toggle saved per account`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | empty or root hash is the teams list | unit | `''`, `'#'`, `'#/'` | `{ name: 'teams' }` | frontend/src/features/shell/routes.test.ts :: empty and root hashes are the teams list |
| C2 | team route | unit | `'#/team/abcdefghijk0123'` | `{ name: 'team', teamId: 'abcdefghijk0123' }` | frontend/src/features/shell/routes.test.ts :: a team hash gives the team route |
| C3 | project route with chapter | unit | `'#/project/abcdefghijk0123/chapter/zyxwvutsrq98765'` | project route with both ids | frontend/src/features/shell/routes.test.ts :: a project hash with a chapter gives both ids |
| C4 | project route without chapter | unit | `'#/project/abcdefghijk0123'` | `chapterId: null` | frontend/src/features/shell/routes.test.ts :: a project hash without a chapter gives a null chapter |
| C5 | invalid ids fall back | unit | uppercase id, 14 and 16 characters, `%20`, empty id | `{ name: 'teams' }` each | frontend/src/features/shell/routes.test.ts :: an invalid id falls back to the teams list |
| C6 | trailing slash and extra segments | unit | `'#/team/<id>/'`, `'#/team/<id>/x'`, `'#/unknown'` | team route; teams; teams | frontend/src/features/shell/routes.test.ts :: one trailing slash is allowed and extra segments are not |
| C7 | round trip | unit | each route of C1 to C4 | `parseRoute(routeToHash(r))` equals `r` | frontend/src/features/shell/routes.test.ts :: routeToHash and parseRoute round-trip |
| C8 | preferences door sends only changed keys | unit | `set({ minimapVisible: false })` on a fake pb | update called with `{ minimap_visible: false }` only; result mapped back | frontend/src/backend/preferences.test.ts :: set sends only the changed preference |
| C9 | phone width | e2e | sign-in screen at 390 × 844 | email field fully inside the viewport, no horizontal scroll | e2e/shell.spec.ts :: sign-in fits a 390 px wide screen |
| C10 | reload keeps the route | e2e | signed in, open a team, reload | the team detail is shown again | e2e/shell.spec.ts :: a reload keeps the open team |
| C11 | theme is saved to the account | e2e | toggle to light, reload; sign in as the same user in a new context | `html[data-theme="light"]` both times | e2e/shell.spec.ts :: the chosen theme follows the account |
### Probes
**Probe folder:** `tests/probes/2026-11-14-editor-core/task-1/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/shell/routes.ts | `[a-z0-9]{15}` | `[a-z0-9]+` | frontend/src/features/shell/routes.test.ts |
### Flow
Sign up, sign in, open a team, switch the theme both ways and reload, at 1280 px and 390 px wide, in Firefox and Chromium. Record what you saw in `progress.md` (light: white panels and soft shadows; dark: flat panels and thin borders; one blue accent).
### Evidence
The full output of `npm run check:task`, the failing run of B1, and the Flow record.
