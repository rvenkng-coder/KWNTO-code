# Quality limits on changed files

Readable beats clever ([engineering.md](../engineering.md) section 1). The limits below keep new and changed code small enough to read. They are checked on **changed files only**, so old code is not forced to change.

## Commands

- `npm run check:quality [-- --base <sha>]`: runs ESLint with `eslint.quality.config.js` on the source files changed since the merge base with `main` (committed, staged, unstaged and untracked; a renamed file under its new path; deleted files never). Prints ESLint's findings (file, line, rule), exit 1 on any violation, and `check:quality: no changed source files` with exit 0 when nothing qualifies. Fails closed: an unknown base, a syntax error in a changed file or an ESLint crash is a non-zero exit with a message.
- `npm run report:quality`: the same limits over every source file in the repository. Prints counts per rule and per file and **always exits 0** (information only, design 6.4). It exits 1 only when it cannot run (git or ESLint failed, or ESLint returned output that is not JSON), never because of a violation.

Files checked: `.ts`, `.tsx` and `.js` under `frontend/src/`, `scripts/` and `backend/pb_hooks/`, except tests (`*.test.*`, `*.spec.*`), `tests/`, `e2e/`, `spike/` and `node_modules/`. The pure part is `filesToCheck` in `scripts/check-changed-quality.ts`; the changed-file list comes from `scripts/lib/changed-files.ts`.

`eslint.quality.config.js` reuses the parsers of `eslint.config.js` but none of its rules, so `npm run lint` is unchanged. PocketBase hook `.js` files are parsed as CommonJS.

## Limits

| Rule | Limit | Why |
|---|---|---|
| `max-lines-per-function` | 50 (80 in `.tsx`); blank lines and comments not counted | A function that fits on one screen can be read without scrolling. A React component holds its markup, so it gets more room. |
| `complexity` | 10 | Each branch is one more case to keep in mind; split a function that has more. |
| `max-depth` | 4 | Deeply nested blocks hide which condition applies; return early or extract. |
| `max-params` | 5 | Many parameters are easy to pass in the wrong order; use an object. |
| `no-debugger` | all files | A stray `debugger` must never be committed. |
| `no-console` | `frontend/src/` and `backend/pb_hooks/` (scripts print by design and are exempt) | The app and the hooks use their own error paths, not console output. |

The numbers are the builder's judgement; the design leaves them open. Change them in `eslint.quality.config.js` and in this table together, and update `tests/lint/quality-config.test.ts`, which pins every limit at its boundary.

## State on 2026-11-13

`npm run report:quality` on `feat/local-ai-quality` (19 findings; later work can see that old code is not being forced to change):

| Rule | Findings |
|---|---|
| `complexity` | 8 |
| `max-lines-per-function` | 5 |
| `no-console` | 5 |
| `max-depth` | 1 |

| File | Findings |
|---|---|
| `backend/pb_hooks/users-signin.pb.js` | 3 |
| `scripts/check-test-hygiene.ts` | 3 |
| `scripts/lib/test-plan.ts` | 2 |
| `frontend/src/backend/errors.ts` | 2 |
| `backend/pb_hooks/admin-controls.pb.js` | 1 |
| `backend/pb_hooks/lib/security-log.js` | 1 |
| `backend/pb_hooks/teams-join.pb.js` | 1 |
| `backend/pb_hooks/teams.pb.js` | 1 |
| `backend/pb_hooks/users-defaults.pb.js` | 1 |
| `scripts/lib/changed-files.ts` | 1 |
| `frontend/src/backend/auth.ts` | 1 |
| `frontend/src/backend/teams.ts` | 1 |
| `frontend/src/features/teams/TeamDetail.tsx` | 1 |

Touching one of these files means the check reports its findings; fix them in that change or split the file first.
