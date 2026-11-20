# Task 5: Comments

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Checkpoint 5C tier:** mid
**Depends on:** Task 3

Design 5: comments attach to a node and show as a flat list, oldest first, in the properties panel, with a count badge on the node. Authors delete their own; the team owner deletes any. Team members and holders of comment and edit links can comment (D8). Security.md 5: an end-to-end test saves `<script>` text as a node title and a comment and confirms it shows as text (Review Focus 5).

**Files:**
- Create: `backend/pb_migrations/1794400200_comments.js`, `backend/pb_hooks/comments.pb.js`, `tests/rules/comments.rules.test.ts`, `frontend/src/backend/comments.ts`, `frontend/src/backend/comments.test.ts`, `frontend/src/features/comments/commentList.ts`, `frontend/src/features/comments/commentList.test.ts`, `frontend/src/features/comments/useNodeComments.ts`, `frontend/src/features/comments/CommentsSection.tsx`, `frontend/src/features/comments/CommentRow.tsx`, `e2e/comments.spec.ts`
- Modify: `frontend/src/backend/client.ts`, `index.ts` (`comments`), `frontend/src/features/editor/panel/NodeFields.tsx` (`CommentsSection` after media), `frontend/src/features/editor/canvas/NodeCard.tsx` (the badge), `frontend/src/features/share/ReadOnlyPanel.tsx` (`CommentsSection` for comment links only), `docs/user/editor.md` ("Comments"), `docs/user/sharing.md` (commenting through a link), `docs/security.md` (section 5 XSS row: the e2e test is built), the ERD (`comments`: `author` optional, `author_name`)

**Interfaces:**
- Consumes: the grant fragment pattern of Task 3 (write a `COMMENT_GRANT` with `permission ?= 'comment' || permission ?= 'edit'` inside one alias, as `EDIT_GRANT` is built); `IS_MEMBER`; `createLink`, `joinShare`, `revokeLink` (`tests/rules/helpers/share.ts`); `memberProject`, `createNode`, `guardedUpdate` (content helpers); `useSelection` (editor), `ReadOnlyPanel`'s slot (Task 4).
- Produces, collection `comments`: `project` (relation, cascade), `node` (relation, cascade), `author` (relation users, optional, not cascade), `author_name` (text, set by the hook), `body` (text, required, max 2000), `created`. Rules: list and view `IS_MEMBER || COMMENT_GRANT`; create `(IS_MEMBER || COMMENT_GRANT) && @request.auth.verified = true && @request.body.author = @request.auth.id && @request.body.node.project = @request.body.project && @request.body.node.deleted_at = '' && @request.body.author_name:isset = false`; update `null`; delete `author = @request.auth.id || project.team.owner = @request.auth.id` (an author who has since lost access still deletes their own, accepted). The hook sets `author_name` from the author's `users.name` (or `Someone` when empty) with the insert outside a transaction of ours (live create events).
- Produces, door `backend.comments`: `list(projectId): Promise<Comment[]>` (oldest first), `create(projectId, nodeId, body): Promise<Comment>`, `remove(id): Promise<void>`, `subscribe(projectId, onEvent): Promise<() => Promise<void>>`; `Comment { id, projectId, nodeId, authorId: string | null, authorName, body, created }`.
- Produces, `commentList.ts`:

```ts
export function applyCommentEvent(list: Comment[], e: { action: 'create' | 'delete'; record: Comment }): Comment[] // create appended once (own echo ignored by id); delete dropped; sorted by created, then id
export function commentsOf(list: Comment[], nodeId: string): Comment[]
export function countLabel(n: number): string   // '' for 0, '1 comment', '<n> comments'
export function canDelete(c: Comment, userId: string, isOwner: boolean): boolean
```

- Produces, screens: `CommentsSection` (heading `Comments`, the list oldest first, each `CommentRow` showing `authorName`, the time and `body` as plain text with line breaks kept by CSS `white-space: pre-wrap`, never as HTML; `Delete` when `canDelete`, with the router's question in the row; a labelled `Add a comment` text area and `Comment` button, disabled when empty or over 2000 characters, with a live `<n>/2000` count). The card badge: a small count (`data-testid="comment-badge"`, `aria-label` = `countLabel`), hidden at 0.

**If interrupted:** the rules and e2e suites run on a throwaway backend; nothing persists.

## Checkpoint 5A: The collection

- [ ] **Step 1: Write the failing tests** C1 to C4 in `tests/rules/comments.rules.test.ts`.
- [ ] **Step 2: Run** `npm run test:rules -- tests/rules/comments.rules.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write** the migration and the hook.
- [ ] **Step 4: Run** `npm run test:rules`. Open the create rule once: C2 must fail; restore. Expected: PASS. **Close checkpoint 5A** (commit `feat: comments collection`).

## Checkpoint 5B: Door and list

- [ ] **Step 5: Write the failing tests** C5 in `commentList.test.ts` and the door's mapping in `comments.test.ts` (C5 also).
- [ ] **Step 6: Run** `npx vitest run --project unit frontend/src/features/comments frontend/src/backend/comments.test.ts`. Expected: FAIL.
- [ ] **Step 7: Implement** the door and `commentList.ts` (the echo rule `if (list.some((c) => c.id === e.record.id)) return list`, B1; `canDelete` is `c.authorId === userId || isOwner`, B2).
- [ ] **Step 8: Run** them. Expected: PASS. **Close checkpoint 5B** (commit `feat: comments door and list`).

## Checkpoint 5C: The panel

- [ ] **Step 9: Write the failing tests** C6 to C8 in `e2e/comments.spec.ts`; run, expect FAIL.
- [ ] **Step 10: Implement** `useNodeComments` (load and subscribe per open project, like `useProjectMedia`; offline: the `Comment` button is disabled with `Comments need a connection.`, comments are not queued), the section, the row and the badge.
- [ ] **Step 11: Run** `npm run test:unit` and `npm run test:e2e`. Expected: PASS. Update the docs. **Close checkpoint 5C** (commit `feat: comments in the panel and on cards`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | who reads comments | rules | member; owner; outsider; signed out; comment-grant and edit-grant holders; a view link's visitor (signed in, no grant); a holder after the link is revoked | member, owner and both grant holders see the project's comments; the rest see none | tests/rules/comments.rules.test.ts :: comments are read by the team and by comment and edit link holders |
| C2 | who writes comments | rules | a verified member; an unverified member; a comment-grant holder; an outsider; signed out; `author` another user; `author_name` sent; a node of another project; a trashed node; a body of 2001 characters; `' OR 1=1 --` as body | member and holder 200, with `author_name` from their account; the body with the injection string stored as typed; every other attempt refused and no row made | tests/rules/comments.rules.test.ts :: only allowed people comment, as themselves, on a live node |
| C3 | who deletes | rules | the author; another member; the owner on a member's comment; a grant holder on someone else's; anyone PATCHes a body | 204; refused; 204; refused; refused | tests/rules/comments.rules.test.ts :: authors delete their own comments and the owner deletes any |
| C4 | comments go with their node | rules | a node with 2 comments is purged (retention 0, `purge_trash`); a teammate's comment arrives on an open subscription | the comments are gone; the create event arrives | tests/rules/comments.rules.test.ts :: comments arrive live and leave with their node |
| C5 | list helpers and door | unit | a create event twice; a delete; `commentsOf`; `countLabel(0)`, `(1)`, `(3)`; `canDelete` for author, other, owner; a mapped record with an empty `author` | appended once; dropped; only that node's, by `created` then id; `''`, `1 comment`, `3 comments`; true, false, true; `authorId` null | frontend/src/features/comments/commentList.test.ts :: comments are listed once, in order, and deleted only by author or owner |
| C6 | comment and see it live | e2e | owner and member on one node; the member comments `Line 3 needs a pause`; the owner deletes it (`Cancel`, then `Delete`) | the owner's panel shows it with the member's name without a reload and the card badge reads 1; no browser dialog; after deleting, both panels and badges clear | e2e/comments.spec.ts :: a comment appears for the team live and the owner can delete it |
| C7 | text, never HTML (security.md 5) | e2e | node title `<img src=x onerror="window.__xss=1">` and a comment `<script>window.__xss=1</script><b>bold</b>`, then reload | both show exactly as typed as text; `window.__xss` is undefined; no `<b>` element inside the comment row | e2e/comments.spec.ts :: titles and comments with HTML show as text |
| C8 | through a comment link | e2e | a comment-link holder opens a node in the viewer and comments; then the link is revoked and they comment again | the comment shows for the team; after revoking, the second is refused with a message and not shown to the team | e2e/comments.spec.ts :: a comment link holder comments until the link is revoked |
### Probes
**Probe folder:** `tests/probes/2026-11-20-sharing/task-5/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/comments/commentList.ts | `if (list.some((c) => c.id === e.record.id)) return list` | `if (false) return list` | frontend/src/features/comments/commentList.test.ts |
| B2 | frontend/src/features/comments/commentList.ts | `c.authorId === userId \|\| isOwner` | `c.authorId === userId` | frontend/src/features/comments/commentList.test.ts |
### Flow
In Firefox and Chromium: comment on several nodes as member and owner, delete as each, watch the badges; comment through a comment link; try a long comment with line breaks. Record what you saw in `progress.md`.
### Evidence
The full output of `npm run check:task`, the Step 4 rule-opening run, the failing run of each break, and the Flow record.
