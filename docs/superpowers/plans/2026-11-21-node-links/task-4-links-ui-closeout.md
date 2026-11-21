# Task 4: The links section, end-to-end test, docs and closeout

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Task 1 and Task 3

**Files:**
- Create: `frontend/src/features/editor/links/linksList.ts`, `linksList.test.ts`, `useProjectLinks.ts`, `useProjectLinks.test.ts`, `LinksSection.tsx`, `LinkItem.tsx`, `frontend/src/features/editor/media/useOnline.ts`, `e2e/editor-links.spec.ts`
- Modify: `frontend/src/features/editor/media/MediaSection.tsx` (import `useOnline` from the new file instead of defining it), `frontend/src/features/editor/panel/NodeFields.tsx` (render `<LinksSection node={node} />` right after `<MediaSection node={node} />`), `frontend/src/features/editor/EditorScreen.tsx` (call `useProjectLinks(projectId)` next to `useProjectMedia(projectId)`), `docs/user/editor.md`, `docs/test-plan.md`, `docs/security.md`, `docs/superpowers/specs/2026-11-11-kwnto-erd.md`, `docs/superpowers/plans/README.md`, `.planning/2026-11-21-node-links/progress.md`

**Interfaces:**
- Consumes: `backend.links` and `NodeLink`, `LinkEvent` (Task 3); `checkLinkUrl`, `linkHost`, `linkLabel` (Task 3).
- Produces in `linksList.ts`: `linksOf(links: NodeLink[], nodeId: string): NodeLink[]` (only that node's links, oldest first) and `applyLinkEvent(links: NodeLink[], event: LinkEvent): NodeLink[]` (`create` adds unless the id is already there; `delete` removes; never duplicates; returns a new array).
- Produces in `useProjectLinks.ts`: `useLinksStore` (Zustand: `projectId: string | null`, `links: NodeLink[]`, `error: string | null`, `open(projectId: string): Promise<() => void>`, `close(): void`, `add(nodeId: string, title: string, url: string): Promise<boolean>`, `remove(link: NodeLink): Promise<void>`, `setError(err: string | null): void`) and `useProjectLinks(projectId: string | null): void`. Write the guard that refuses a bad address as the exact text `if (!check.ok) {` (a break targets it): `add` runs `checkLinkUrl`, and on refusal sets `error` to its message, makes no backend call and returns false. Writes for a project land only while it is still the open one (as `forProject` does in `useProjectMedia.ts`). `useOnline(): boolean` moves unchanged into `media/useOnline.ts`.
- Produces: `LinksSection({ node }: { node: StoryNode })`, `data-testid="links-section"`; items `data-testid="link-item"`.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 4A: the pure list and the store

- [ ] **Step 1: Write failing tests** `linksList.test.ts` and `useProjectLinks.test.ts` (C1 to C3; mock `backend.links` as `useProjectMedia.test.ts` mocks `backend.media`).
- [ ] **Step 2: Run, expect FAIL**: `npx vitest run frontend/src/features/editor/links`.
- [ ] **Step 3: Implement** `linksList.ts` and `useProjectLinks.ts`; write `linksOf` with the exact text `.filter((l) => l.nodeId === nodeId)` (a break targets it).
- [ ] **Step 4: Run, expect PASS. Commit** `feat: the links list and store`.

## Checkpoint 4B: the section, wiring and the end-to-end test

- [ ] **Step 1: Write the failing e2e** `e2e/editor-links.spec.ts`, reusing the setup helpers of `e2e/editor-media.spec.ts` (C4 to C7).
- [ ] **Step 2: Run, expect FAIL**: `npm run test:e2e -- e2e/editor-links.spec.ts`.
- [ ] **Step 3: Implement** `LinksSection.tsx` and `LinkItem.tsx`, move `useOnline`, and wire `NodeFields.tsx` and `EditorScreen.tsx`. Behaviour: heading `Links and other material`; two inputs labelled `Link title` and `Link address` and a button `Add link` (disabled while offline, with the line `Links need a connection. Try again when you are back online.`); each item is an `<a>` whose text is `linkLabel(link)` with the host in muted text beside it, `href` the stored address, `target="_blank"` and `rel="noopener noreferrer"`, and a button `Delete link` that deletes at once (no confirmation: a link is cheap to add again, D5); an error shows as `role="alert"` text in the danger colour and is cleared when another node is selected (as `MediaSection` does); the form clears after a successful add. The title is rendered as text only. Each file stays under 300 lines.
- [ ] **Step 4: Run, expect PASS**: `npm run test:unit`, `npm run test:e2e -- e2e/editor-links.spec.ts e2e/editor-media.spec.ts`. Close the checkpoint (one commit).

## Checkpoint 4C: docs and closeout

- [ ] **Step 1: Update the docs.**
  - `docs/user/editor.md`: a "Links and other material" subsection after Media (what it is, adding, deleting, only web addresses, "to share a video, link it").
  - `docs/security.md`: a control for link addresses (the rule, where it is enforced twice, the `noopener noreferrer`, why `javascript:` is refused).
  - `docs/superpowers/specs/2026-11-11-kwnto-erd.md`: the `node_links` entity next to `media`.
  - `docs/test-plan.md`: a row for this plan, layers covered, and the manual case M-links (the Flow below).
  - `docs/superpowers/plans/README.md`: add this plan to the roadmap with status `awaiting developer review`, and under the open items change "Upload progress or chunked upload (D13)" to say video upload is switched off by this plan and chunked upload stays open (the first VM measured about 0.2 MB/s through Funnel on 2026-11-21; a 30 MB and a 150 MB upload both failed).
  - `.planning/2026-11-21-node-links/progress.md`: copy the table from `docs/superpowers/plans/PROGRESS-TEMPLATE.md` and add a row per closed checkpoint.
- [ ] **Step 2: Run everything:** `npm test`, `npm run test:e2e`, then `npm run check:task` for this task. Paste the full output.
- [ ] **Step 3: Commit** `docs: node links` and stop. The plan is `awaiting developer review`; only the developer marks it `done`.

## Test plan

### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | a node's links, oldest first | unit | `linksOf` over links of two nodes with out-of-order `created` | only that node's, sorted by `created` ascending | frontend/src/features/editor/links/linksList.test.ts :: a node's links come oldest first |
| C2 | events never duplicate | unit | `applyLinkEvent` with `create` twice for one id, then `delete`, then `delete` again | one entry after the first two; none after; the second delete changes nothing; the input array is not mutated | frontend/src/features/editor/links/linksList.test.ts :: link events never duplicate or mutate |
| C3 | the store refuses a bad address before the server, and drops a late answer | unit | `add('n1','t','javascript:alert(1)')`; then a valid `add` whose answer arrives after `open` of another project | first: returns false, `error` is `Only http:// and https:// addresses are allowed.`, `backend.links.add` not called; second: the old project's answer is not written | frontend/src/features/editor/links/useProjectLinks.test.ts :: the store refuses bad addresses and drops late answers |
| C4 | a member adds a link and it is safe to click | e2e | add title `Trailer`, address `https://example.com/video` on a node | an item with text `Trailer` and `example.com`; its anchor has that `href`, `target` `_blank`, `rel` containing `noopener` and `noreferrer`; the form is empty | e2e/editor-links.spec.ts :: a link is added and opens safely |
| C5 | unsafe input is refused and nothing is added | e2e | `javascript:alert(1)`; then 2001 characters; then a title `<script>window.__x=1</script>` with a good address | the message shows each time for the first two and no item exists; the third shows the title as text and `window.__x` is undefined | e2e/editor-links.spec.ts :: unsafe addresses are refused and titles stay text |
| C6 | delete, reload, and per node | e2e | add on node A; reload; open node B; delete on A | the link is still there after reload; node B shows none; after delete it is gone | e2e/editor-links.spec.ts :: links persist, belong to their node and can be deleted |
| C7 | a teammate sees it live | e2e | two browser contexts on the same project; A adds then deletes | B shows the link without a reload, then loses it | e2e/editor-links.spec.ts :: a teammate sees links appear and go without a reload |

### Probes
**Probe folder:** `tests/probes/2026-11-21-node-links/task-4/`

### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/links/linksList.ts | `.filter((l) => l.nodeId === nodeId)` | `.filter((l) => l.nodeId !== nodeId)` | frontend/src/features/editor/links/linksList.test.ts |
| B2 | frontend/src/features/editor/links/useProjectLinks.ts | `if (!check.ok) {` | `if (check.ok) {` | frontend/src/features/editor/links/useProjectLinks.test.ts |

### Flow
On the VM (the walk): open a node, add a link to a real video (for example a YouTube address), click it, and check it opens in a new tab and the app tab stays; try `javascript:alert(1)` and see it refused. Record the result in `progress.md` as M-links.

### Evidence
The full output of `npm run check:task`, the failing run of each break, and the Flow result when the developer has done it.
