# Task 9: Local-model runbook and server ping

Part of the [Local-AI Quality plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid  
**Depends on:** Task 8

**Files:**
- Create: `scripts/ping-local-model.ts`, `scripts/ping-local-model.test.ts`, `docs/developer/local-model-runbook.md`
- Modify: `docs/developer/local-model-notes.md` ("After it finishes" points to `check:task`; the manual steps it replaces are marked), `docs/superpowers/plans/TASK-TEMPLATE.md` (the sized-for-the-local-model block, see Step 5), `package.json` (`ping:model`), `AGENTS.md`

**Interfaces:**
- Produces, `scripts/ping-local-model.ts`:

```ts
export interface PingResult { ok: boolean; loaded: boolean; detail: string }
export async function pingModelServer(baseUrl: string, fetchFn?: typeof fetch, timeoutMs?: number): Promise<PingResult>
```

It asks `<baseUrl>/running` (llama-swap lists the running models there): `ok` is false if the server does not answer within `timeoutMs` (default 3000) or answers a non-2xx status; `loaded` is true if the answer lists a model that is ready; `loaded: false` with `ok: true` means the server answers but the model is idle (the first request will load it, which can take a while). Command: `node scripts/ping-local-model.ts [baseUrl]` (default `http://localhost:9092`); prints one line (`model server: answering, model loaded`, `answering, model idle (loads on the first request)` or `NOT answering: <reason>`); exit 0 if answering, 1 if not. It never sends a prompt and never sends anything but the GET.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 9A: the ping

- [ ] **Step 1: Write failing tests** `scripts/ping-local-model.test.ts` with an injected fake `fetch` and, for the command, a throwaway `node:http` server: `a 200 with a running model is ok and loaded`; `a 200 with an empty running list is ok and idle`; `a 500 is not ok and says the status`; `a connection refused is not ok and says so`; `no answer within the timeout is not ok (use a fake that never resolves and timeoutMs 50)`; `invalid JSON in a 200 answer is ok but reports loaded unknown as idle and says the answer was not understood`; `the command exits 0 when answering and 1 when not`; `only GET is sent` (record the method on the throwaway server).
- [ ] **Step 2: Run** `npx vitest run --project unit scripts/ping-local-model.test.ts`; FAIL. **Step 3: Implement.** **Step 4: Run**; PASS. **Step 5: Close checkpoint 9A** (commit `feat: local model ping`).

## Checkpoint 9B: the runbook and the template block

- [ ] **Step 6: Write `docs/developer/local-model-runbook.md`** from the real procedure in `local-model-notes.md` (do not invent commands; copy them): before the run (`npm run ping:model`, the sandbox or worktree, which files the model may touch and the "stop and report if you need to touch anything else" rule, the instruction not to read `tests/probes/`), starting it (`little-coder -p --session-dir <dir> "<prompt>"`), the one-minute check for a session file and what to look at if there is none (GPU and slots, kill and restart a run that is alive but idle), after the run (`npm run check:task -- --task <file>`, paste the output, never grade from its summary, read the session log for tests-before-code, any path outside the sandbox, any read of `tests/probes/`), when to escalate to a strong model (a FAIL after two rounds, or a security-relevant file), and how the sample review is chosen (link to `review-sampling.md`). Include a prompt template with placeholders for the task file path and checkpoint.
- [ ] **Step 7: Update `local-model-notes.md`**: in "After it finishes", mark steps 1, 2, 3 and 5 as done by `check:task` (name the step) and keep 4 (the unseen probe set) and 6 (read the log) as what a person still does; add a link to the runbook at the top. Do not delete the history of the smoke tests.
- [ ] **Step 8: Template block.** In `TASK-TEMPLATE.md` add a short "Sized for the local model" block the writer fills in when the tier is `local`: the files it may touch (exhaustive), the interfaces it must not change, "stop and report if you need to touch anything else", the model-server check, and the one checkpoint it is given. `check:plan` (Task 2) must still pass on the template (it is excluded from the default scan; run it explicitly on a copy in a temp folder to confirm). If a tier of `local` should require this block, add that rule to `check:plan` with a test (`a local task without the block is a problem`); the decision is **[my call]**: yes, require it.
- [ ] **Step 9: Verify** `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run check:docs`. Commit `docs: local model runbook, ping and local-task block`. **Step 10: Close checkpoint 9B.**

## Test plan

Builds the checks. The silent-stall case (server not answering, or idle and slow to load) is the reason for this task: the tests `no answer within the timeout` and `loaded false means idle`.
