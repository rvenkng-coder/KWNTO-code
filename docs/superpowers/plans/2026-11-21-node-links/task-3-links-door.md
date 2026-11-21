# Task 3: The links door and the client address check

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Task 2

**Files:**
- Create: `frontend/src/backend/link-types.ts`, `frontend/src/backend/links.ts`, `frontend/src/features/editor/links/linkCheck.ts`, `frontend/src/features/editor/links/linkCheck.test.ts`, `tests/rules/links-door.rules.test.ts`
- Modify: `frontend/src/backend/client.ts` (the `Backend` interface and `createBackend` gain `links`), `frontend/src/backend/index.ts` (`export type * from './link-types'` and a `links` getter like the others)

**Interfaces:**
- Consumes: the collection and rules of Task 2.
- Produces in `link-types.ts`: `interface NodeLink { id: string; projectId: string; nodeId: string; creatorId: string; title: string; url: string; created: string }` and `interface LinkEvent { action: 'create' | 'delete'; record: NodeLink }`.
- Produces in `links.ts`: `createLinks(pb: PocketBase)` returning `{ list(projectId: string): Promise<NodeLink[]>; add(projectId: string, nodeId: string, title: string, url: string): Promise<NodeLink>; remove(id: string): Promise<void>; subscribe(projectId: string, onEvent: (e: LinkEvent) => void): Promise<() => Promise<void>> }`. Follow `media.ts`: errors pass through `toBackendError`; `list` sorts by `created`; `add` sends `creator` as `pb.authStore.record?.id`; `subscribe` filters by project and passes only `create` and `delete`.
- Produces in `linkCheck.ts`: `checkLinkUrl(raw: string): { ok: true; url: string } | { ok: false; message: string }` (same rule and messages as the server, D4); `linkHost(url: string): string` (the text between `://` and the next `/`, `?` or `#`, lower-cased); `linkLabel(link: { title: string; url: string }): string` (the title when it is not blank, else the host).

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 3A: the client check (pure)

- [ ] **Step 1: Write failing tests** `linkCheck.test.ts` (C1 to C3).
- [ ] **Step 2: Run, expect FAIL**: `npx vitest run frontend/src/features/editor/links/linkCheck.test.ts`.
- [ ] **Step 3: Implement** the three functions. Write these two lines exactly (breaks target them): `const MAX_LENGTH = 2000` and `const WEB_ADDRESS = /^(https?):\/\/([^\s/?#@\\]+)([/?#]\S*)?$/i`. Same order of checks and the same message choice as `checkLinkUrl` in `backend/pb_hooks/lib/link-check.js` (read it; the code field is dropped here).
- [ ] **Step 4: Run, expect PASS. Commit** `feat: the client link address check`.

## Checkpoint 3B: the door

- [ ] **Step 1: Write failing tests** `tests/rules/links-door.rules.test.ts` in the style of `media-door.rules.test.ts` (a `doorFor(user)` helper, a recorder for live events) (C4 to C6).
- [ ] **Step 2: Run, expect FAIL**: `npm run test:rules -- tests/rules/links-door.rules.test.ts`.
- [ ] **Step 3: Implement** `link-types.ts`, `links.ts`, and wire `client.ts` and `index.ts`.
- [ ] **Step 4: Run, expect PASS**: `npm run test:rules`, `npm run test:unit`, `npm run typecheck`. Close the checkpoint (one commit).

## Test plan

### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | good addresses pass and are trimmed | unit | `checkLinkUrl('  https://example.com/a ')`, `HTTP://EXAMPLE.COM` | `ok: true`, trimmed `url` | frontend/src/features/editor/links/linkCheck.test.ts :: web addresses pass and are trimmed |
| C2 | unsafe addresses are refused with the router's messages | unit | the same table as Task 2 C2 | each `ok: false`; empty gives `Enter a web address.`; other schemes `Only http:// and https:// addresses are allowed.`; the rest `That is not a web address.`; 2001 characters `The address is longer than 2000 characters.` | frontend/src/features/editor/links/linkCheck.test.ts :: unsafe addresses are refused |
| C3 | host and label | unit | `linkHost('https://Example.COM:8080/a?b#c')`; `linkLabel({title:'  ', url:'https://x.example/p'})`; `linkLabel({title:'Trailer', url:'https://x.example/p'})` | `example.com:8080`; `x.example`; `Trailer` | frontend/src/features/editor/links/linkCheck.test.ts :: the host and the label |
| C4 | the door adds, lists and removes | rules | a member signs in through the door, adds a link, lists, removes | `add` returns a `NodeLink` with the member as `creatorId`; `list` has it; after `remove` the list is empty | tests/rules/links-door.rules.test.ts :: a member adds, lists and removes a link through the door |
| C5 | the server refusal reaches the caller | rules | `add` with `javascript:alert(1)` | rejects with a `BackendError` whose `fields.url` is `Only http:// and https:// addresses are allowed.` | tests/rules/links-door.rules.test.ts :: a refused address reaches the caller with its message |
| C6 | teammates see changes live, outsiders do not; the client and the server agree | rules | teammate B subscribes; A adds and removes; outsider subscribes; then a table of 12 addresses is checked with `checkLinkUrl` and sent by the door | B gets `create` then `delete`; the outsider gets nothing; for every address `checkLinkUrl(...).ok` equals whether the door's `add` succeeded | tests/rules/links-door.rules.test.ts :: teammates see links live, outsiders do not, and the client check agrees with the server |

### Probes
**Probe folder:** `tests/probes/2026-11-21-node-links/task-3/`

### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/links/linkCheck.ts | `const WEB_ADDRESS = /^(https?):\/\/([^\s/?#@\\]+)([/?#]\S*)?$/i` | `const WEB_ADDRESS = /^(https?\|ftp):\/\/([^\s/?#@\\]+)([/?#]\S*)?$/i` | frontend/src/features/editor/links/linkCheck.test.ts |
| B2 | frontend/src/features/editor/links/linkCheck.ts | `const MAX_LENGTH = 2000` | `const MAX_LENGTH = 20000` | frontend/src/features/editor/links/linkCheck.test.ts |
| B3 | frontend/src/features/editor/links/linkCheck.ts | `const WEB_ADDRESS = /^(https?):\/\/([^\s/?#@\\]+)([/?#]\S*)?$/i` | `const WEB_ADDRESS = /^(https?):\/\/([^\s/?#\\]+)([/?#]\S*)?$/i` | frontend/src/features/editor/links/linkCheck.test.ts |

### Flow
none

### Evidence
The full output of `npm run check:task` and the failing run of each break.
