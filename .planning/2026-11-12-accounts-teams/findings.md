# Findings: Accounts and teams

Record anything unexpected here: PocketBase behaviour that differs from what the plan assumed, and what was done about it.

## Task 1

- **Migrations are not isolated like hooks.** In PocketBase 0.40.6 a migration file's top-level `const` and `function` are visible inside its `migrate()` callbacks (`1794360000_system_settings.js` uses a `TABLES` list and a `count()` helper; the rule tests pass). The isolated-scope rule of the router applies to hook handlers only.
- **Settings numbers are not `required`.** A required `number` field rejects `0` in PocketBase (zero is "blank"), and 0 is a legitimate value for some settings. They are `onlyInt` with `min: 0` instead; the row always exists, and `lib/settings.js` throws if it does not.
