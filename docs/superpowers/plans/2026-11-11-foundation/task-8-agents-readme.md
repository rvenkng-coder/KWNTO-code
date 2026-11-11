# Task 8: AGENTS.md, README and developer guide

Part of the [Foundation and Real-Time Spike plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** local-OK  
**Depends on:** Task 7

**Files:**
- Create: `docs/developer/getting-started.md`
- Modify: `AGENTS.md`, `README.md`, `docs/README.md`

**If interrupted** (see the router, "Surviving interruptions"):
- Nothing here leaves state outside the working tree. Follow the router's resume steps.

## Checkpoint 8A: Getting-started guide

- [ ] **Step 1: `docs/developer/getting-started.md`:** prerequisites (Node 22, Docker, gitleaks), first run (`npm install`, copy `.env.example` to `.env` and set both values, `npm run dev:backend`, `npm run dev`), and a table of every npm script in `package.json` with one line each.
- [ ] **Close checkpoint 8A.** Verify: `npm run check:docs` is clean and every npm script in `package.json` appears in the guide. Commit: `docs: getting-started guide`.

## Checkpoint 8B: AGENTS.md, README and docs index

- [ ] **Step 2: `AGENTS.md`** (design section 7; keep under 80 lines), with these sections: what KWNTO is (two sentences and a link to the design); read first (design, ERD, engineering.md, security.md, the current plan); repo layout (`src/features/`, `src/backend/`, `backend/`, `tests/rules/`, `tests/container/`, `e2e/`, `scripts/`, `spike/`, `docs/`); commands (`npm test` and each layer); hard rules copied from this plan's Global Constraints (one door, 300 lines, no `any`, deny by default, no new dependencies, ask-first list, never merge to `main`, never edit a failing test, prototype is reference only); how to add a collection (migration, then `tests/rules/<name>.rules.test.ts`); tracking and resuming (checkpoints, `.planning/`, and the resume steps from this plan's router, in short form).
- [ ] **Step 3: `README.md`:** replace the placeholder text with what KWNTO is, its status (in development, internal tool), quick start (link to getting-started), and links to the design and docs. `docs/README.md`: an index linking every file under `docs/`.
- [ ] **Step 4: Run** `npm run check:docs`. Expected: no broken links. Check by hand that every npm script in `package.json` appears in getting-started.
- [ ] **Close checkpoint 8B.** Verify: Step 4 passed. Commit: `docs: AGENTS.md, README and docs index`.
