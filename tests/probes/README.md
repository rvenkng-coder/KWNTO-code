# Probes

A probe is a test written from a task's Test plan and the kind catalogue in [testing-strategy.md](../../docs/testing-strategy.md), not from the task's own tests. It tries the code from outside, with inputs the implementer did not choose. Files are `tests/probes/<plan>/<task>/<row>.probe.test.ts`.

- **Title form:** `[<row id>] <kind>: <description>`, for example `[C3] second-bad-item: two notes in one file`. `<kind>` is a lower-case slug from the catalogue. Only the row and the kind are ever shown to the implementer.
- **Who runs them:** only `check:task` and `npm run check:probes -- <folder>` run these files (the `probes` Vitest project). `npm test` and `npm run test:unit` do not.
- **Sealed by norm:** the prompt for a task never names this folder, and the implementer is told not to read it. The session log shows whether it did; review checks that.
- **Output:** a failing probe prints `FAIL <row> (<kind>)` and nothing else. See [Running the probes](../../docs/developer/test-plan-format.md#running-the-probes).
