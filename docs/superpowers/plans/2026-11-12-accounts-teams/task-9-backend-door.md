# Task 9: The backend door for accounts and teams

Part of the [Accounts and Teams plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid  
**Depends on:** Tasks 3, 4, 6, 7 and 8

**Files:**
- Create: `src/backend/types.ts`, `src/backend/errors.ts`, `src/backend/errors.test.ts`, `src/backend/mappers.ts`, `src/backend/mappers.test.ts`, `src/backend/auth.ts`, `src/backend/teams.ts`, `tests/rules/backend-door.rules.test.ts`
- Modify: `src/backend/client.ts` (`Backend` gains `auth` and `teams`), `src/backend/index.ts`, `docs/developer/backend.md`

**Interfaces:**
- Consumes: the collections and routes of Tasks 3 to 8 (by the exact names and messages in their Interfaces blocks).
- Produces, `src/backend/types.ts`:

```ts
export interface AuthUser { id: string; email: string; name: string; verified: boolean }
export interface Team { id: string; name: string; isOwner: boolean }
export interface TeamMember { id: string; userId: string; name: string; role: 'owner' | 'member' }
export interface TeamSettings { joinCode: string; joinCodeEnabled: boolean }   // owner only
export interface Invite { id: string; teamName: string; invitedByName: string }
```

- Produces, `src/backend/errors.ts`:

```ts
export type BackendErrorKind = 'invalid' | 'locked' | 'forbidden' | 'not-found' | 'conflict' | 'unreachable' | 'unknown'
export class BackendError extends Error { kind: BackendErrorKind; status: number; fields: Record<string, string> }
export function toBackendError(err: unknown): BackendError
// status 0 or a network failure -> 'unreachable'; 400 -> 'invalid' (fields from response.data.<name>.message);
// 401 and 403 -> 'forbidden'; 404 -> 'not-found'; 409 -> 'conflict'; 429 -> 'locked'; anything else -> 'unknown'.
// message is the server's message when it sent one, otherwise a short generic text. Never throws.
```

- Produces, `src/backend/mappers.ts`: `toAuthUser(record)`, `toTeam(record, userId)`, `toTeamMember(record)`, `toInvite(record)` turning PocketBase records into the types above (record parameter typed as `Record<string, unknown>`, no `any`).
- Produces, on the existing `Backend` (the single place the app talks to the server):

```ts
backend.auth: {
  signUp(email: string, password: string, name: string): Promise<void>           // does not sign in; the account needs verification
  signIn(email: string, password: string): Promise<AuthUser>
  signOut(): void
  current(): AuthUser | null                                                      // from the stored session
  refresh(): Promise<AuthUser | null>                                             // re-reads the account (for the verified flag); null if the session is dead
  requestVerification(email: string): Promise<void>
  requestPasswordReset(email: string): Promise<void>
  onChange(listener: (user: AuthUser | null) => void): () => void                 // returns an unsubscribe function
}
backend.teams: {
  list(): Promise<Team[]>
  create(name: string): Promise<Team>
  remove(teamId: string): Promise<void>
  members(teamId: string): Promise<TeamMember[]>
  removeMember(memberId: string): Promise<void>
  settings(teamId: string): Promise<TeamSettings>
  setJoinCodeEnabled(teamId: string, enabled: boolean): Promise<void>
  regenerateJoinCode(teamId: string): Promise<string>
  join(code: string): Promise<Team>
  invite(teamId: string, email: string): Promise<void>
  invites(): Promise<Invite[]>
  acceptInvite(inviteId: string): Promise<Team>
  declineInvite(inviteId: string): Promise<void>
}
```

All methods reject with a `BackendError`, never a raw SDK error.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 9A: Errors and mappers (pure)

- [ ] **Step 1: Write the failing tests** `src/backend/errors.test.ts` and `src/backend/mappers.test.ts` (header comment: protects design 6.7, an unreachable or refusing backend is a normal state the UI reports, and the rule that screens never see SDK types). Cases: `toBackendError(new ClientResponseError({ status: 0, response: {} }))` has kind `unreachable`; status 400 with `data.password.message = 'Use at least 10 characters.'` gives kind `invalid` and `fields.password` equal to that text; 429 gives `locked` and keeps the server's message `Too many failed sign-in attempts. Try again after 5 minutes.`; 403, 404, 409 map as in the Interfaces block; a plain `new Error('x')` gives `unknown` with message `x`; `toBackendError(undefined)` does not throw. Mappers: `toAuthUser` copies the four fields and defaults `name` to `''`; `toTeam` sets `isOwner` only when `owner === userId`; `toTeamMember` reads the `user_name` copy; `toInvite` reads `team_name` and `invited_by_name`.
- [ ] **Step 2: Run** `npm run test:unit`; expected FAIL. **Step 3: Implement `types.ts`, `errors.ts`, `mappers.ts`.** Run again; expected PASS.
- [ ] **Close checkpoint 9A.** Verify: Step 3 passed, `npm run lint` clean. Commit: `feat: backend door errors and mappers`.

## Checkpoint 9B: The auth and teams calls

- [ ] **Step 4: Write the failing test** `tests/rules/backend-door.rules.test.ts` (it drives the real door against the live test backend, using `createBackend(PB_URL)`; a second door instance per person). Header comment: protects the whole chain door -> routes -> rules for the flows of Tasks 3 to 8.
  - sign up with `signUp`, then `signIn` as an unverified account succeeds and `current().verified` is `false`; after the admin verifies the account, `refresh()` shows `verified: true`.
  - verified owner `create('Crew')` returns a team with `isOwner: true`; `list()` returns it; a second user's `list()` does not.
  - `settings(team)` as owner returns an 8-character `joinCode`; as a member it rejects with kind `forbidden` or `not-found`.
  - `setJoinCodeEnabled(true)`, then the second user `join(code)` returns the team with `isOwner: false`; `members()` shows both by name; `removeMember` then `list()` for the second user is empty.
  - `invite(team, email)` for an unknown email rejects with kind `not-found` and the message `That user doesn't exist.`; for a real one resolves; the invitee's `invites()` has one entry; `acceptInvite` returns the team.
  - three wrong `signIn` calls then a correct one rejects with kind `locked`.
  - an unverified user's `create('x')` rejects with kind `forbidden`.
  - `signOut()` makes `current()` null and `onChange` listeners get `null` once.
- [ ] **Step 5: Run** `npm run test:rules`; expected FAIL. **Step 6: Implement `auth.ts` and `teams.ts`** (each a `create...(pb: PocketBase)` function returning the object above; every call wrapped so errors go through `toBackendError`; custom routes called with `pb.send`; filters use `pb.filter` with bound parameters). Wire them into `createBackend` and `index.ts`. Run `npm run test:rules`; expected PASS.
- [ ] **Step 7: Run** `npm test`. Expected: every layer passes (the existing `health()` test and the e2e smoke test still pass).
- [ ] **Step 8: Document** the door in `docs/developer/backend.md`: the two objects, the error kinds and what the UI should do for each.
- [ ] **Close checkpoint 9B.** Verify: Step 7 passed. Commit: `feat: backend door for accounts and teams`.
