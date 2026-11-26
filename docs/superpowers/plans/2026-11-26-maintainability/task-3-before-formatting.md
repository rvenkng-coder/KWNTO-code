# Task 3: Prepare for formatting

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** 2

**Files:**
- Create: `frontend/src/features/editor/sync/syncResolve.test.ts`
- Modify: `scripts/lib/test-raw.ts`, `scripts/check-test-hygiene.scanner.test.ts`, `frontend/src/features/editor/sync/syncResolve.ts`, `frontend/src/features/editor/sync/syncEngine.ts`, `frontend/src/backend/index.ts`, `eslint.config.js`, `docs/developer/editor.md`

**Interfaces:**
- Produces: `export async function applyChoice(storage: OutboxStorage, conflict: PendingConflict, choice: 'mine' | 'theirs'): Promise<Answer | null>` in `syncResolve.ts`

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 3A: The assertion counter

Prettier breaks `await expect.poll(...)` across lines, and the raw counter then reports a lost assertion.

- [ ] **Step 1: Add to `check-test-hygiene.scanner.test.ts`** (import `countRawExpects` from `./lib/test-raw.ts`):

```ts
// Protects: the assertion count does not change when a formatter splits `expect.poll` over lines.
test('an expect split over lines is still counted', () => {
  expect(countRawExpects('await expect\n  .poll(read)\n  .toBe(1)\nexpect\n  .soft(a)\n  .toBe(2)')).toBe(2)
})
```

- [ ] **Step 2: Run** `npx vitest run --project unit scripts/check-test-hygiene.scanner.test.ts`. Expected: FAIL, 0 instead of 2.
- [ ] **Step 3: Set `EXPECT`** in `test-raw.ts` to `/\bexpect(?:\s*\.\s*(?:soft|poll))?\s*\(/g`. Run again: PASS. Commit `fix: count an expect split over lines`.

## Checkpoint 3B: The sync engine and the backend index

- [ ] **Step 4: Write `syncResolve.test.ts`** against a `createMemoryOutbox()` holding one `update` of node `n1` (`changes: { title: 'Mine' }`, `baseValues: { title: 'Old' }`, `baseVersion: 3`), each test with a `// Protects:` line:
  - `keeping theirs drops the entry and reports the server copy`: conflict `fields: ['title']`, server version 5 → returns `{ seq, type: 'theirs', server }`; `list('u1')` is empty.
  - `keeping mine re-queues the entry on the server version`: same conflict → returns `null`; the stored entry has `baseVersion: 5` and `baseValues.title` equal to the server's title.
  - `keeping mine with nothing to restore fails the entry`: `deleted: true`, `server: null`, `snapshot: null` → returns `type: 'refused'` with message `The record was deleted and no copy of your change is left to restore it.`; `failed('u1')` has one entry.
- [ ] **Step 5: Run it.** Expected: FAIL, `applyChoice` is not exported.
- [ ] **Step 6: Move `NO_COPY` and the choice logic into `syncResolve.ts`:**

```ts
/** Writes the answer to a conflict into the outbox. Returns what to tell the screens, or null when the entry will be sent again. */
export async function applyChoice(storage: OutboxStorage, conflict: PendingConflict, choice: 'mine' | 'theirs'): Promise<Answer | null> {
  const { entry, server } = conflict
  const replacement = choice === 'mine' ? mineEntry(conflict) : theirsEntry(conflict)
  if (replacement !== null) await storage.put(replacement)
  else if (choice === 'theirs') await storage.remove([entry.seq])
  else await storage.fail(entry, NO_COPY)
  if (choice === 'theirs') return { seq: entry.seq, type: 'theirs', server }
  return replacement === null ? { seq: entry.seq, type: 'refused', message: NO_COPY } : null
}
```

  Inside `Engine.resolve`'s `exclusive` block keep this order: `applyChoice`, `this.conflict = null`, `await this.refresh()`, then announce the answer if it is not null.
- [ ] **Step 7: Reduce `markReachable`** to `this.attempt = 0` and `this.serverDown = false`.
- [ ] **Step 8: In `backend/index.ts`**, add `const lazy = (): Backend => (_backend ??= createBackend())` and make each getter `return lazy().<name>` (`health` too). The exported names and types do not change.
- [ ] **Step 9: In `eslint.config.js`**, allow 500 lines for `frontend/src/**/*.test.{ts,tsx}` (comment the reason).
- [ ] **Step 10: Add "Sync engine states"** to `docs/developer/editor.md`: a Mermaid state diagram of idle, sending, backing off, waiting for a conflict answer and not the sending tab, each arrow naming the method that causes it, and one line per boolean field of `Engine`.
- [ ] **Step 11: Run** `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e -- e2e/editor-offline e2e/editor-conflicts`. Expected: PASS, and `syncEngine.ts` is at least 10 code lines shorter (formatting adds lines to it). Commit `refactor: shorten the sync engine and the backend index`.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | split expect counted | unit | `expect` then `.poll(` on the next line | counted | scripts/check-test-hygiene.scanner.test.ts :: an expect split over lines is still counted |
| C2 | keep theirs | unit | all fields conflict | entry removed, server copy reported | frontend/src/features/editor/sync/syncResolve.test.ts :: keeping theirs drops the entry and reports the server copy |
| C3 | keep mine | unit | server version 5 | entry re-queued on version 5 | frontend/src/features/editor/sync/syncResolve.test.ts :: keeping mine re-queues the entry on the server version |
| C4 | keep mine, deleted | unit | no snapshot | entry failed, refusal reported | frontend/src/features/editor/sync/syncResolve.test.ts :: keeping mine with nothing to restore fails the entry |
### Probes
**Probe folder:** none
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | scripts/lib/test-raw.ts | `expect(?:\s*\.\s*(?:soft\|poll))?` | `expect(?:\.(?:soft\|poll))?` | scripts/check-test-hygiene.scanner.test.ts |
| B2 | frontend/src/features/editor/sync/syncResolve.ts | `else if (choice === 'theirs') await storage.remove([entry.seq])` | `else if (choice === 'mine') await storage.remove([entry.seq])` | frontend/src/features/editor/sync/syncResolve.test.ts |
### Flow
Offline: edit a title, change the same title in a second browser, reconnect, answer the conflict with each choice.
### Evidence
The failing runs of steps 2 and 5, the step 11 summary, the flow result and the `check:task` output.
