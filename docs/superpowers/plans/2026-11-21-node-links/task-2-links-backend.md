# Task 2: The links collection, the address check and the hook

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** none

**Files:**
- Create: `backend/pb_migrations/1794400100_node_links.js`, `backend/pb_hooks/lib/link-check.js`, `backend/pb_hooks/links.pb.js`, `tests/hooks/link-check.unit.test.ts`, `tests/rules/node_links.rules.test.ts`
- Modify: none

**Interfaces:**
- Produces (in `link-check.js`, exported the same way `media-check.js` exports its functions):
  `checkLinkUrl(raw: string): { ok: true, url: string } | { ok: false, code: 'link_url_empty' | 'link_url_invalid' | 'link_url_scheme' | 'link_url_too_long', message: string }`.
  `url` is the trimmed input, not rewritten. Messages are the four in the router's Copy section: empty gives `Enter a web address.`; too long gives `The address is longer than 2000 characters.`; a well-formed `scheme://` with a scheme other than http or https gives `Only http:// and https:// addresses are allowed.`; anything else gives `That is not a web address.`
- Produces: collection `node_links` with fields `project` (relation to `projects`, required, cascadeDelete true), `node` (relation to `nodes`, required, cascadeDelete true), `creator` (relation to `users`, required, cascadeDelete false), `title` (text, max 120), `url` (text, required, max 2000), `created` (autodate, onCreate); indexes on `project` and `node`.
- Rules (constant `IS_MEMBER` as in `1794380000_media.js`): list and view `IS_MEMBER`; create `IS_MEMBER && @request.auth.verified = true && @request.body.creator = @request.auth.id && @request.body.node.project = @request.body.project`; update `null`; delete `IS_MEMBER`.

**If interrupted:** the migration has a `down` that deletes the collection.

## Checkpoint 2A: the address check (pure)

- [ ] **Step 1: Write failing tests** `tests/hooks/link-check.unit.test.ts` (Test plan C1 to C3).
- [ ] **Step 2: Run, expect FAIL**: `npx vitest run tests/hooks/link-check.unit.test.ts`.
- [ ] **Step 3: Implement `checkLinkUrl`**. PocketBase's JS runtime has no `URL` class, so use the regex. Write these two lines exactly (breaks target them):
  `const MAX_LENGTH = 2000` and `const WEB_ADDRESS = /^(https?):\/\/([^\s\/?#@\\]+)([\/?#]\S*)?$/i`. Order of checks: trim; empty (`link_url_empty`); longer than `MAX_LENGTH` (`link_url_too_long`); matches `WEB_ADDRESS` (ok). Otherwise choose the refusal: if the trimmed text starts with `http://` or `https://` (case-insensitive) it is `link_url_invalid` (this covers `https://`, a space in the address and a user name in front); else if it starts with `//` or with a scheme (`/^[a-z][a-z0-9+.-]*:/i`) it is `link_url_scheme`; else `link_url_invalid`.
- [ ] **Step 4: Run, expect PASS. Commit** `feat: the link address check`.

## Checkpoint 2B: collection, hook, rules

- [ ] **Step 1: Write failing rules tests** `tests/rules/node_links.rules.test.ts` using the helpers `memberProject`, `createNode`, `asUser`, `asAdmin`, `createUser`, `addMember` as `media.rules.test.ts` does; clean the collection in `afterEach` as it does (C4 to C9).
- [ ] **Step 2: Run, expect FAIL** (collection missing): `npm run test:rules -- tests/rules/node_links.rules.test.ts`.
- [ ] **Step 3: Write the migration** `1794400100_node_links.js` (pattern: `1794380000_media.js`). Write `links.pb.js` with `onRecordCreate((e) => { ... }, "node_links")` that requires `${__hooks}/lib/link-check.js`, runs `checkLinkUrl(e.record.getString("url"))`, on failure throws `new BadRequestError(message, { url: new ValidationError(code, message) })`, and on success sets the record's `url` to the trimmed value and its `title` to the trimmed title; then `e.next()`.
- [ ] **Step 4: Run, expect PASS**: `npm run test:rules`, `npm run test:unit`. Close the checkpoint (one commit).

## Test plan

### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | good addresses are accepted and trimmed | unit | `checkLinkUrl('  https://example.com/a?b=1#c ')`, `HTTP://EXAMPLE.COM`, `http://localhost:8090/x` | `ok: true`, `url` is the trimmed text | tests/hooks/link-check.unit.test.ts :: web addresses are accepted and trimmed |
| C2 | unsafe or malformed addresses are refused with the right code and message | unit | `javascript:alert(1)`, ` JavaScript:alert(1)`, `data:text/html,x`, `ftp://a.b`, `file:///etc/passwd`, `//evil.example`, `https://`, `https://a b`, `https://user:pw@host.example`, `https://google.com@evil.example`, `example.com`, ``, `   ` | each `ok: false`; empty and blank give `link_url_empty`; `javascript:`, `data:`, `ftp:`, `file:` and `//evil.example` give `link_url_scheme`; the rest `link_url_invalid` | tests/hooks/link-check.unit.test.ts :: unsafe and malformed addresses are refused |
| C3 | the length limit is exact | unit | `https://a.example/` padded to 2000 characters, then 2001 | 2000 ok, 2001 `link_url_too_long` | tests/hooks/link-check.unit.test.ts :: the length limit is 2000 |
| C4 | a member adds a link; the server sets nothing the client may not | rules | verified member creates `{project, node, creator: self, title: ' Trailer ', url: ' https://example.com/v '}` | 200; `title` is `Trailer`; `url` is `https://example.com/v`; `creator` is the member | tests/rules/node_links.rules.test.ts :: a member adds a link and the server trims it |
| C5 | only a verified member adds, as themself, to their own project | rules | signed out; verified outsider; unverified member; member with `creator` of another user; member with a node of another project | all refused (not 200); no row exists | tests/rules/node_links.rules.test.ts :: only a verified member adds a link, as themself, in their own project |
| C6 | a bad address is refused with the field error | rules | a member sends each C2 address that matters (`javascript:alert(1)`, `https://google.com@evil.example`, empty, 2001 characters) | 400; `data.url.message` is the matching message from the router; no row exists. Also `HTTPS://OK.example` is 200 | tests/rules/node_links.rules.test.ts :: the server refuses unsafe addresses with a clear message |
| C7 | members read; outsiders and anonymous do not; injection finds nothing | rules | member lists and views; outsider and anonymous list and view; outsider lists with filter `id != ''` and with `title ~ "'; --"` | member sees the rows; the others get empty lists or 404 and the injection returns 0 rows | tests/rules/node_links.rules.test.ts :: only team members read links |
| C8 | nobody updates; any member deletes; an outsider cannot | rules | PATCH by member, owner, outsider; DELETE by outsider, then by a member | PATCH refused for all; DELETE refused for the outsider; 204 for the member | tests/rules/node_links.rules.test.ts :: links are never updated and any member deletes |
| C9 | links go with their node, project and team | rules | one link each; admin deletes the node, the project, the team | each link is gone afterwards | tests/rules/node_links.rules.test.ts :: deleting a node, project or team removes its links |

### Probes
**Probe folder:** `tests/probes/2026-11-21-node-links/task-2/`

### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | backend/pb_hooks/lib/link-check.js | `const WEB_ADDRESS = /^(https?):\/\/([^\s\/?#@\\]+)([\/?#]\S*)?$/i` | `const WEB_ADDRESS = /^(https?\|ftp):\/\/([^\s\/?#@\\]+)([\/?#]\S*)?$/i` | tests/hooks/link-check.unit.test.ts |
| B2 | backend/pb_hooks/lib/link-check.js | `const MAX_LENGTH = 2000` | `const MAX_LENGTH = 20000` | tests/hooks/link-check.unit.test.ts |
| B3 | backend/pb_hooks/lib/link-check.js | `const WEB_ADDRESS = /^(https?):\/\/([^\s\/?#@\\]+)([\/?#]\S*)?$/i` | `const WEB_ADDRESS = /^(https?):\/\/([^\s\/?#\\]+)([\/?#]\S*)?$/i` | tests/hooks/link-check.unit.test.ts |

### Flow
none

### Evidence
The full output of `npm run check:task` and the failing run of each break.
