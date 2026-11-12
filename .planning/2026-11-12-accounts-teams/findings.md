# Findings: Accounts and teams

Record anything unexpected here: PocketBase behaviour that differs from what the plan assumed, and what was done about it.

## Task 1

- **Migrations are not isolated like hooks.** In PocketBase 0.40.6 a migration file's top-level `const` and `function` are visible inside its `migrate()` callbacks (`1794360000_system_settings.js` uses a `TABLES` list and a `count()` helper; the rule tests pass). The isolated-scope rule of the router applies to hook handlers only.
- **Settings numbers are not `required`.** A required `number` field rejects `0` in PocketBase (zero is "blank"), and 0 is a legitimate value for some settings. They are `onlyInt` with `min: 0` instead; the row always exists, and `lib/settings.js` throws if it does not.
- **`lib/*.js` needs a CommonJS marker for Vitest.** The root `package.json` has `"type": "module"`, so Node loads `backend/pb_hooks/lib/*.js` as ES modules and `module.exports` fails (`ReferenceError: module is not defined in ES module scope`). Added `backend/pb_hooks/package.json` with `{"type": "commonjs"}`; the plan's `.js` file names stay. PocketBase ignores the file (it loads only `*.pb.js`); rule tests and a probe confirm hooks still load.
- **Probe of the hook runtime (throwaway container, temporary route).** Inside PocketBase 0.40.6: `getSystemAccess` and `getSystemBehavior` return the documented shapes with the defaults; `logEvent` writes an entry, and with an invalid type it prints `security log: could not record a "not-a-type" event: GoError: type: Invalid value not-a-type.` and does not throw; `require(`${__hooks}/lib/...`)` and the global `Record` work from a required module; with `security_retention_days = 0`, `POST /api/crons/purge_security_events` (204) removed every entry.
- **No automated purge test yet.** It would need `security_retention_days` changed during a run, but rule files still run in parallel and `system_behavior.rules.test.ts` asserts the default 365, so it would be flaky. The rule test pins that the job is registered (`0 3 * * *`); the purge itself was checked by the probe above. Once Task 3 sets `fileParallelism: false`, an end-to-end purge test can be added safely.
