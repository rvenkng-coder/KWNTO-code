# Recipes

Which files to change, in order, for three common changes. Each step names what fails if you miss it. "Nothing fails" means you must check that step yourself. A `typecheck` failure needs the new field to be required: an optional (`?`) field passes it everywhere. Write the failing test first, as in [workflow.md](workflow.md).

## 1. Add a field to a node

| # | File | What to add | If missed |
|---|---|---|---|
| 1 | A new file in `backend/pb_migrations/` | The field on `nodes`. Never edit a migration that has run | The app cannot save it |
| 2 | `frontend/src/backend/content-types.ts` | The field on `StoryNode`, and in `EditableFields['nodes']` if people edit it | `npm run typecheck`, at the first use |
| 3 | `frontend/src/backend/content-mappers.ts` | The read mapping; the key in `EDITABLE.nodes`; the stored name in `STORED_NAME` if it differs (`coverMediaId` is `cover_media`) | The read mapping: `npm run typecheck`. The other two: nothing fails, and the value is not saved |
| 4 | `frontend/src/features/editor/model/fixtures.ts` and `canvas/newNode.ts` | The default value | `npm run typecheck` |
| 5 | `frontend/src/features/editor/sync/outboxText.ts` | The name shown for the field in `LABELS` | Nothing fails; the conflict dialog shows the raw name |
| 6 | `backend/pb_hooks/lib/project-records.js` | The field and its kind in `READ.nodes` | The export lacks it |
| 7 | `backend/pb_hooks/lib/project-file-build.js`, `project-file-validate.js`, `project-file-plan.js`, `project-import.js` (and `project-file-limits.js` if it has a limit) | Write it to the file, accept and check it, plan it, import it. `validate` names a node's keys in two places | `npm run test:rules` (`project-file.fields.rules.test.ts`) once step 9 lists it as carried |
| 8 | `frontend/src/backend/share-types.ts` and `features/share/shareModel.ts` (and `ReadOnlyCard.tsx` if viewers see it) | The field in the shared view | `shareModel.ts`: `npm run typecheck`. The rest: nothing fails |
| 9 | `tests/rules/helpers/file-contract.ts` and `carried.ts` | List it as carried, or as never carried with the reason | `npm run test:rules` fails for a field in neither list |
| 10 | The [ERD](../superpowers/specs/2026-11-11-kwnto-erd.md) and [project-file.md](project-file.md) | The new field | Nothing fails |

Copy and paste takes the whole node, so a new field travels with it.

## 2. Add a collection

1. Write the migration in `backend/pb_migrations/`. Rules are `null` (admins only) unless you open them.
2. Write `tests/rules/<name>.rules.test.ts` for list, view, create, update and delete: signed out, another user, the owner, and an injection string. `npm run test:rules` fails without a file of that exact name.
3. If a rule is public (`""`), add it to `PUBLIC_RULES` in `tests/rules/helpers/coverage.ts` with a comment citing the design section. The rules tests fail otherwise.
4. If the collection belongs to a project (it has a `project` relation), list it in `tests/rules/helpers/file-contract.ts`: its fields as carried or never carried, or the whole collection as not imported. The rules tests fail otherwise.
5. Add it to the [ERD](../superpowers/specs/2026-11-11-kwnto-erd.md), and to [security.md](../security.md) if it changes who can see what.

## 3. Add a backend service

Only `frontend/src/backend/` talks to PocketBase.

1. `frontend/src/backend/<name>.ts`: a `create<Name>(pb)` function that returns the calls, with its types in `<name>-types.ts`. Screens never see a PocketBase record.
2. `frontend/src/backend/<name>.test.ts`: unit tests with a fake client.
3. `frontend/src/backend/client.ts`: add it to the `Backend` interface and to `createBackend`. `npm run typecheck` fails if one of the two is missing.
4. `frontend/src/backend/index.ts`: one getter that returns `lazy().<name>`, and `export type * from './<name>-types'`. `npm run typecheck` fails without the getter.
