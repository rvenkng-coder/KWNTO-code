# Task 1: Lint the backend hooks

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** none

**Files:**
- Modify: `eslint.config.js`, `backend/pb_hooks/lib/link-check.js`, `docs/developer/lint.md`

**Interfaces:** none

**If interrupted:** nothing leaves state outside the working tree.

- [ ] **Step 1: Add a block to `eslint.config.js`** for `backend/pb_hooks/**/*.js` that extends `js.configs.recommended`, with:
  - `languageOptions`: `ecmaVersion: 2023`, `sourceType: 'commonjs'`, `globals.commonjs`, `console`, and these read-only PocketBase globals: `__hooks $app $apis $security $dbx $os $mails $filesystem $template $http routerAdd routerUse cronAdd migrate onBootstrap toString toBytes sleep arrayOf DynamicModel Record Collection BadRequestError ForbiddenError NotFoundError ApiError UnauthorizedError ValidationError MailerMessage TextField NumberField SelectField RelationField DateField JSONField BoolField FileField AutodateField EmailField URLField Field DateTime onRecordCreate onRecordUpdate onRecordCreateRequest onRecordUpdateRequest onFileDownloadRequest onRecordAfterUpdateSuccess onRecordAfterCreateSuccess onRecordAuthWithPasswordRequest onRecordAuthRequest onRecordConfirmPasswordResetRequest onRecordConfirmVerificationRequest`
  - `linterOptions: { reportUnusedDisableDirectives: 'off' }` (the `no-console` disables are used by `eslint.quality.config.js`)
  - rules `no-unused-vars: ['error', { caughtErrors: 'none' }]` (do not rewrite `catch (error)`: the engine may not accept `catch {`) and `max-lines` as for `frontend/src`
- [ ] **Step 2: Run `npx eslint backend/pb_hooks`.** Expected: only the two `no-useless-escape` errors in `lib/link-check.js`. A real `no-undef` is a bug: stop and report it.
- [ ] **Step 3: Remove the two useless `\/` escapes inside the character classes** of `WEB_ADDRESS`. Leave the escapes outside the classes.
- [ ] **Step 4: Prove the lint catches a typo:** change one `e.next()` to `ee.next()`, run `npm run lint`, see `'ee' is not defined`, restore.
- [ ] **Step 5: Run** `npm run lint`, `npm run test:unit`, `npm run test:rules`. Expected: PASS with no warnings.
- [ ] **Step 6: Describe the hook rules in `docs/developer/lint.md`** and commit `chore: lint the backend hooks`.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | An undefined name in a hook fails lint | manual | `ee.next()` | `npm run lint` reports `no-undef` |  |
| C2 | The address rule behaves as before inside PocketBase | manual | `npm run test:rules` | all pass |  |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
Run steps 4 and 5 and record what each printed.
### Evidence
The failing lint of step 4, the rules summary and the `check:task` output.
