---
name: local-task
description: "Use this skill FIRST whenever you are given a task file (docs/superpowers/plans/.../task-N-*.md) or a checkpoint to implement in the KWNTO repo. It is the rule set for one task: what you may touch, test-first order, what never to do, and how to finish with `npm run check:task` and report honestly. Triggers on: do Checkpoint, implement this task, task file, check:task, local model task."
---

# Local task protocol

You are doing ONE checkpoint of ONE task. A tool (`check:task`) checks your work at the end; it cannot be argued with and you must not weaken it.

## Before you write anything

1. Read the task file you were given, and the files it links. Nothing else yet.
2. Find these in it: **May touch**, **Must not change**, **Checkpoint given**, and the Test plan (case table, Breaks, Probe folder).
3. Work only inside the folder you were given, with relative paths.
4. Do NOT read anything under `tests/probes/`. Those tests are hidden on purpose. If you open one, say so in your report.

## Order of work (every step, no skipping)

1. Write the failing tests first. Use exactly the test titles in the Test plan's case table.
2. Put a `// Protects:` comment above each test (one plain sentence: what breaks if this test is wrong).
3. Run the tests. They must FAIL, and for the right reason (not a typo or a missing import). If they pass before you wrote code, the test is wrong: fix the test.
4. Write the smallest code that makes them pass.
5. Run the tests again. Run `npm run lint` and `npm run typecheck`.
6. Close the checkpoint with ONE commit, using the message the task gives. Do not push.

## Never

- Never edit an existing test to make it pass. If a test fails, fix the code. If the test itself looks wrong, STOP and say so.
- Never use `it.skip`, `test.skip`, `.only`, `.todo`, `xit` or `test.fixme`.
- Never use `any` without a comment explaining why. Keep files under 300 lines.
- Never add a dependency. Never run `npm install` or change anything under `node_modules/`.
- Never touch a file outside "May touch". If you need to, STOP and report instead of doing it.
- Never import `pocketbase` outside `src/backend/`.
- Never push, merge, delete data, or touch Docker volumes.
- Never claim something passed that you did not run. If you could not run it, say that.

## Finish

Run this from the repo root (the `--base` commit is in your prompt; if it is missing, STOP and ask for it):

```
npm run check:task -- --task <task file> --base <baseline sha>
```

Paste the ENTIRE output into your report, not a summary. The last line is `check:task: PASS` or `check:task: FAIL (n steps)`.

- On FAIL: read the failing step, fix the CODE, run it again. After two rounds that still FAIL, stop and report what is failing and why. Do not weaken a test, a break, or a check to get a PASS.
- Report: what you built, the commit hash, the pasted output, anything you were unsure about, and whether you opened anything under `tests/probes/`.
