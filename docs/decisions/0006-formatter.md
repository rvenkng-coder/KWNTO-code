# 0006: Formatter

**Date:** 2026-11-26
**Status:** accepted by the developer with the maintainability plan

Code layout is set by one tool, so nobody formats by hand and a diff shows only real changes. This adds one development dependency and approves nothing else.

| Package | Version | Used by | What for | Licence |
|---|---|---|---|---|
| `prettier` | `3.10.1` (exact) | `npm run format`, `npm run format:check`, the CI `checks` job | Layout of `.ts`, `.tsx` and `.js` files | MIT |

It has no dependencies of its own and nothing of it ships in the app.

## Settings

`.prettierrc.json`: no semicolons, single quotes (double quotes in `backend/pb_hooks`), line width 120. These match how the code was already written. `.prettierignore` leaves out build output, the prototype, spikes, probe files, agent folders and `backend/pb_migrations` (a migration that has run is not changed without asking).

## Used for layout only

Prettier moves line breaks, quotes and commas. It finds no mistakes; ESLint and TypeScript do that.

## Alternatives

| Option | Why not |
|---|---|
| Biome | A formatter and a second linter; the project already has ESLint |
| dprint | Smaller community and fewer editor plugins |
| ESLint Stylistic | Many separate rules to choose and keep consistent |
| `max-len` alone | Reports long lines but fixes none |

## How to bump

1. Read the changelog of the new version.
2. `npm install --save-dev --save-exact prettier@<version>`.
3. `npm run format` in the same pull request, as its own commit, and add that commit to `.git-blame-ignore-revs`.
4. `npm test`.
