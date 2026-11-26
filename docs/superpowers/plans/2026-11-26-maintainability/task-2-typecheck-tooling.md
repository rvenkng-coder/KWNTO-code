# Task 2: Typecheck tests, end-to-end tests and scripts

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** none

**Files:**
- Create: `tsconfig.tooling.json`
- Modify: `tsconfig.json`, `e2e/accounts.spec.ts`, `e2e/verify-gate.spec.ts`, `tests/container/edge.test.ts`, `tests/rules/helpers/media.ts`, `tests/rules/content-door.rules.test.ts`, `tests/rules/content-door-offline.rules.test.ts`, `tests/rules/media-door.rules.test.ts`, `tests/rules/users.signup.rules.test.ts`, `docs/developer/testing.md`, `docs/developer/check-task.md`

**Interfaces:** none

**If interrupted:** nothing leaves state outside the working tree.

- [ ] **Step 1: Create `tsconfig.tooling.json`** and add `{ "path": "./tsconfig.tooling.json" }` to the references in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "node_modules/.tmp/tsconfig.tooling.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "strict": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "skipLibCheck": true,
    "jsx": "react-jsx"
  },
  "include": ["scripts", "tests", "e2e", "vitest.config.ts", "playwright.config.ts"],
  "exclude": ["tests/probes"]
}
```

- [ ] **Step 2: Run `npm run typecheck`.** Expected: FAIL with 24 errors in the test files listed above.
- [ ] **Step 3: Fix types only.** No assertion, input value or title changes.
  - `helpers/media.ts`: type the byte helpers as `Uint8Array<ArrayBuffer>` (this should also clear `media-door.rules.test.ts`).
  - `content-door*.rules.test.ts`: add the record fields the types gained (`width`, `height`, `coverMediaId`, `deletedAt`, `created` where reported) with their empty values. If an assertion then fails, stop and report.
  - `accounts.spec.ts`: read `__xss` as `share-viewer-xss.spec.ts` does.
  - `verify-gate.spec.ts`, `edge.test.ts`, `users.signup.rules.test.ts`: narrow the reported value; no `any`.
- [ ] **Step 4: Run** `npm run typecheck`, `npm run test:container`, `npm run test:rules`, `npm run test:e2e -- e2e/accounts.spec.ts e2e/verify-gate.spec.ts`. Expected: PASS.
- [ ] **Step 5: Say in `docs/developer/testing.md` that `typecheck` covers tests and scripts**, and commit `chore: typecheck tests, end-to-end tests and scripts`.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | A type error in a test fails the typecheck | manual | `const n: number = 'x'` added to a rules test, then removed | `npm run typecheck` fails and names the file |  |
| C2 | The edited tests behave as before | manual | rules, container and the two end-to-end specs | all pass |  |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
Add the type error of C1, run the typecheck, remove it; then run step 4.
### Evidence
The step 2 error list, the step 4 summaries and the `check:task` output.
