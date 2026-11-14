# Working with the local model: what we learned

Notes from two smoke tests of the local coding model on this project (2026-11-12), kept so later work and later projects can plan around its limits. These are two samples, not a benchmark: use them to decide where to be careful, not as proof of what the model can or cannot do.

**To hand a task to the local model, follow the [runbook](local-model-runbook.md).** This page keeps what we learned and why; the runbook is the procedure.

## The setup

| Part | What it is |
|---|---|
| Harness | `little-coder` 1.20.0 (npm global; the program calls itself `pi`) |
| Model | `coder` on a local llama-swap server (port 9092), a Qwen3.6-35B-A3B mixture-of-experts model (3B active parameters), 200k context, unloads after 600 s idle |
| Default | Provider `llamacpp`, model `coder`, set in `~/.pi/agent/settings.json` |
| Cost | Zero: it runs on the developer's own machine and nothing leaves it |

Run one task without a person at the keyboard:

```sh
little-coder -p --session-dir <dir> "<prompt>"
```

For a real task, start with `--skill .pi/skills/local-task` and tell the model to use it: see the [runbook](local-model-runbook.md#starting-it) (the skill is only read when the prompt asks for it).

`--session-dir` keeps the log of every tool call, which is how you check the process afterwards. Add `--no-tools --no-context-files --no-extensions --no-skills` for a quick "does it answer?" check (about 8 s when the model is loaded).

## What we ran

Both runs used a throw-away sandbox: a fresh `git init` of the repo at a known commit, with no remote, so the model could not touch real branches or push. The model got the plan files or a bug report and nothing else.

| Test | Task | Result |
|---|---|---|
| 1 | Plan Task 4, Checkpoint 4B (write the PERF comment check, test first, close the checkpoint) | Passed the plan's tests and the close-out. Hidden bugs: 3 of 7 edge cases failed. |
| 2 | Fix those bugs from a bug report listing 7 cases | Passed all 7 and wrote good tests. Hidden cases: 4 of 11 more still failed. |

## What it did well

- **Followed the process.** Tests first, watched them fail for the right reason, fixed in small steps, never edited an existing test, one commit with the requested message, no push.
- **Honest reports.** Its final summaries matched what we found; it did not claim a result it had not seen.
- **Plan close-out.** Ticked boxes, status cell, progress line and doc edits were all done correctly.
- **Stayed in its folder** once told to (test 1 wandered to a made-up path and searched outside the sandbox; test 2 made none of those mistakes).

## Where it falls short

1. **It solves the examples, not the cause.** Told that `// PERF:` after code was missed, it fixed that and left the block-comment twin (`x() /* PERF: ... */`) broken. Told that two notes in one run must be judged separately, it split only when the first note was complete, so a complete note still hid an incomplete one. Expect the stated cases to pass and their relatives to fail.
2. **Its failures are false negatives.** A check that silently passes bad input is the worst kind for a guardrail. The model's own tests did not reveal them, because it wrote tests for the cases it was given.
3. **It trusts the tests it was given.** The plan's four tests were satisfied by wrong code. A weak test set is a weak result, and the model does not notice.
4. **It can stall without saying so.** The first launch of test 2 sat for 3.5 minutes with the process alive, the GPU at 0%, every inference slot empty and no session log. llama-swap had been unloading the model after its 600 s idle timeout and dropping a stream. Nothing reported an error. A person has to look.
5. **Slow in bursts.** Test 1 took about 11 minutes and 45 tool calls; test 2 took about 15 minutes, 8 of them silent before its first command.
6. **Not tested here:** strong-tier work (debugging a surprising backend, security rules, a flawed measurement). Task 3 of the plan needed exactly that, and a model that stops at the stated cases would likely have recorded a wrong result. Treat the strong tier as unproven for this model.

## How to account for it

**Where to use it.** Local-OK and mid-tier checkpoints, one at a time, where the plan gives exact steps and the check is objective. Keep strong tasks (backend rules, anything security-relevant, measurements, debugging) and the review itself on a stronger model.

**Before handing work over**
- Write the tests that carry the real quality bar first, including the awkward cases, or have someone else write them. Do not let the model's own tests be the bar.
- Give a bug report as symptoms plus the cause class ("trailing comments of any kind"), not one example.
- Tell it to work only inside the sandbox folder and give paths as relative.
- Check the model server is loaded and answering before a long run: `npm run ping:model` (it asks `/running` and prints one line; it replaces `curl localhost:9092/running`). A one-word prompt (the `--no-tools` check above) is still the test that the model itself answers.

**While it runs**
- If there is no session file after about a minute, look at the GPU and the llama-swap slots (`/upstream/coder/slots`) before waiting longer. Kill and restart a run that is alive but idle.

**After it finishes** (grade from your own runs, never from its summary)
Steps 1, 2, 3 and 5 are now done by `npm run check:task -- --task <file>` ([check-task.md](check-task.md)); run it yourself and read the full output. Steps 4 and 6 stay with a person.
1. Run lint, tests and typecheck yourself. *Done by `check:task`: the `lint`, `typecheck` and `unit` steps (and `layers` for rules, e2e or container tests the plan names).*
2. Confirm no existing test lost a line (`git diff <base> -- <test file>`, look for removed lines). *Done by `check:task`: the `hygiene` step (a lost test or assertion fails).*
3. Run its new tests against the old, buggy code: they must fail where the bugs are. *Done by `check:task`: the `breaks` step applies the plan's deliberate breaks and each must be caught; the `coverage` step checks the named tests exist.*
4. Run a probe set it was not shown, written to cover the whole class of the bug: other comment forms, line endings, order of items, empty input, two bad items together. **Still a person's job:** `check:task` runs the task's own probe folder (the `probes` step), but a person should add cases the plan's author did not think of.
5. Run any command-line or glue code against deliberately bad input and check the exit code and message. *Done by `check:task` only as far as the Test plan has such cases and probes; a command with no bad-input case in its plan is not covered, so look.*
6. Read the session log: tests before code? a red that fails for the right reason? any path outside the sandbox? how many tool calls and minutes? **Still a person's job:** `check:task` cannot see the session.

**In review, look hardest at** code that decides whether something is allowed or reported. Anything that can pass silently needs a test for the failing input, not only the passing one.

## Probe cases worth reusing

The cases the model missed are in issue 4 on GitHub (cases 8 to 11) and in `docs/developer/lint.md` for the rule they protect. When a new feature has a "check" that scans input, write the same kinds of probe: the form after code on the same line, the second item hidden behind a good first one, and two bad items in one file.

## Re-running the smoke test

`npm run prepare-local-run` automates steps 1 and 2 and builds the prompt ([prepare-local-run.md](prepare-local-run.md)); the recipe below is what it does.

1. `git archive <commit> | tar -x -C <sandbox>`, then `git init` and one baseline commit in it. Link `node_modules` from the real checkout.
2. Confirm the baseline: checks clean, existing tests green, the target behaviour absent.
3. Run the model with a prompt that names exactly one checkpoint or bug and the rules above.
4. Grade with the list in "After it finishes".
5. Delete the sandbox.
