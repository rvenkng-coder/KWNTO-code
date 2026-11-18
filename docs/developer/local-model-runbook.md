# Runbook: handing a task to the local model

How to give one checkpoint to the local coding model (`little-coder`, model `coder` on llama-swap, port 9092) and grade what comes back. The reasons behind each rule, and the history of the smoke tests, are in [local-model-notes.md](local-model-notes.md). Use the local model only for a task or checkpoint whose tier is `local` and whose task file carries the "Sized for the local model" block ([format](test-plan-format.md#the-local-tier-block)).

## Before the run

Run `npm run prepare-local-run -- <plan folder> <task> [<checkpoint>]` ([prepare-local-run.md](prepare-local-run.md)). It prints the command to start the run and never starts the model. What it does for you, and why each rule exists:

1. **Pings the server** (`npm run ping:model`, also usable alone, or with `-- http://host:port`). It asks llama-swap's `/running` with a GET, never sends a prompt, and prints one line:
   - `model server: answering, model loaded`: go ahead.
   - `model server: answering, model idle (loads on the first request)`: go ahead, but the first request is slow while the model loads. The model unloads after 600 s idle, which is how a run can stall without a message. A `; the /running answer was not understood` suffix means the server answered something this check does not recognise: treat it as not loaded.
   - `model server: NOT answering: <reason>` (exit 1): do not start. Start or restart llama-swap first. A bad argument (not an `http(s)` URL) exits 2 with a message.
2. **Gives it a sandbox**, not your working checkout: a fresh `git init` of HEAD with no remote, no push-capable protocol, no credential helper and no hooks in its local config, and the global git config ignored. This is a guard rail, not a security boundary: the model could change that config, and anything it runs outside git can reach your global `gh` login. The checkout must have no uncommitted changes to tracked files, because the sandbox is built from HEAD, and the model sees everything tracked there (`.planning/` included). Its `node_modules` is a link to the real one, so a write there (`npm install`, `tsc -b` cache files) lands in the real checkout. The manual recipe is in [local-model-notes.md](local-model-notes.md#re-running-the-smoke-test).
3. **Tells it which files it may touch.** The task file's "May touch" and "Must not change" lines go into the prompt, with the rule: **stop and report if you need to touch anything else.**
4. **Tells it not to read `tests/probes/`.** The probes are the unseen set; if the model reads them they stop being unseen. The prompt says not to read `tests/probes/`; the exact folder is named in the task file's Test plan (`**Probe folder:**`), which the model reads, so the session log is checked for reads of it.
5. **Gives it one checkpoint**, the one named under "Checkpoint given". It also refuses a task whose tier is not `local`.

**What the ping reads.** llama-swap's `/running` is not documented in this repository. The check was written for the shape llama-swap is known to answer, `{"running":[{"model":"coder","state":"ready"}]}` (a bare array of the same entries is accepted too), and the one answer seen on this machine, `{"running":[]}` (model idle), matches it. A model is "loaded" only when an entry has `"state":"ready"`; an entry in another state (such as `starting`) counts as idle. The model name is not checked: a `ready` entry with any name (or none) counts as loaded, so `ping:model` says the server has a ready model, not that it is `coder`. The state word is read without regard to case; a state word other than `ready`, `starting`, `stopping`, `stopped` or `shutdown` is reported as not understood. A baseUrl with a user name or password is refused (exit 2) and never printed. If llama-swap changes the shape, the line says "not understood" instead of claiming the model is loaded.

## Starting it

The start command is `little-coder -p --session-dir <dir> --skill .pi/skills/local-task "<prompt>"`. `--session-dir` keeps the log of every tool call. Use a new directory per run. `--skill .pi/skills/local-task` loads the [local-task skill](../../.pi/skills/local-task/SKILL.md): the short rule set the model follows for one checkpoint (what to read, test-first order, what never to do, how to finish with `check:task`). **The skill is not applied by itself**: the model only reads it when the prompt tells it to, and it needs its tools to do so (a run with `--no-tools` answers from general knowledge; tested 2026-11-13). So the prompt must start with the "use the local-task skill" line, and a run whose session log shows no read of `SKILL.md` did not follow it.

The prompt is written by `prepare-local-run` to `PROMPT.md` in the run directory (outside the sandbox) from this template: it starts with `First, use the local-task skill.`, names the sandbox, the checkpoint and the task file, copies the "May touch" and "Must not change" lines, says to stop and report for anything else, not to read `tests/probes/`, to write the failing tests first, never to edit an existing test, to close the checkpoint with one commit without pushing, and to end with `npm run check:task -- --task <task file> --base <baseline sha>` pasted in full. The command it prints is:

```sh
cd <sandbox> && little-coder -p --session-dir <run dir>/session --skill .pi/skills/local-task "$(cat <run dir>/PROMPT.md)"
```

The skill repeats the rules of the prompt on purpose: the prompt carries this task's values (paths, baseline commit), the skill carries the rules that never change. Edit the skill when a run shows the model breaking a rule; keep it under about 50 lines, because a small model follows a short list better than a long one.

## Sub-coders (`dispatch`) and the one model slot

`little-coder` has a built-in `dispatch` tool that starts read-only child sessions for research. Facts, checked 2026-11-13 against this machine's server and the installed `little-coder`:

- The `coder` model has **one slot**. Two requests at once do not fail; the second waits for the first (about twice the time in a test), so parallel children give no speedup.
- Children run **one at a time by default**; `LITTLE_CODER_SUBCODER_CONCURRENCY` raises that. Leave it unset.
- Each child is a separate process with **its own empty context**: it sees only the task text it is given, never the main session's history, the `local-task` skill, `AGENTS.md` or the probe rule. Only its final answer comes back.
- Children are **read-only** unless `LITTLE_CODER_SUBCODER_ACCESS=write` is set. Leave it unset: all edits stay in the main session, which follows the skill and ends with `check:task`.
- A child's reads show up in the session log only inside the one `dispatch` call, so a read of `tests/probes/` by a child is easy to miss. Tell the model not to dispatch anything about `tests/probes/`, and look inside `dispatch` calls when you read the log.
- The extension `pi-subagents` (full-tool subagents through `pi-tasks`, `TaskExecute`) is not installed for `little-coder` here. Do not rely on it.

## The one-minute check

About a minute after the start, look for a session file in the `--session-dir`. If there is none:

- Look at the GPU (is it busy?) and at the llama-swap slots: `curl localhost:9092/upstream/coder/slots` (the command from the notes).
- A process that is alive, with the GPU at 0% and every slot empty, is stalled (this happened in smoke test 2). **Kill the run and restart it**; run `npm run ping:model` again first.

## After the run

A strong model doing this work uses the `grading-local-task` skill ([.claude/skills/grading-local-task/SKILL.md](../../.claude/skills/grading-local-task/SKILL.md)), which follows the steps below and the next section in order and records the result.

1. Run it yourself, in the sandbox or worktree: `npm run check:task -- --task <task file> --base <baseline sha> [--built-by local]` (the options and the steps are in [check-task.md](check-task.md)). **`--base` is mandatory:** you know the commit the sandbox started from; without it the default (merge base with `main`) can equal HEAD, and a check on an empty change set would otherwise pass on nothing (it now fails).
2. **Paste the full output** in the task report. **Never grade from the model's own summary**, and not from a summary of the output either: a `FAIL` verdict means the task is not done.
3. Read the session log (the part of grading `check:task` cannot do):
   - Were the tests written before the code, and did the first run fail for the right reason?
   - Did it touch any path outside the sandbox, or outside "May touch"? (`git status` and `git diff --stat <base>` show it; the log shows reads.)
   - Did it read `SKILL.md` at the start (a `read` of `.pi/skills/local-task/SKILL.md` early in the log)? If not, the skill was not applied: restart with the prompt's first line.
   - Did it read anything under `tests/probes/`? If so the probe result no longer counts: have the probes rewritten or reviewed by a person.
   - How many tool calls and minutes? (Smoke tests: about 11 to 15 minutes, 45 or more tool calls.)
4. Run the unseen probe set a person wrote beyond the task's own probe folder (step 4 of "After it finishes" in the notes).
5. Review when the rule says so: `check:task` prints `Review required: yes` or `no` ([review-sampling.md](review-sampling.md)). Record the outcome in the progress row (Built by, Review, Escaped).

## Bringing the work into the working branch

The sandbox is a separate repository with no remote, and git there cannot fetch or push, so nothing flows back by itself. You carry the commits over as a patch. Do this only when the sandbox's `check:task` has no `FAIL` other than rows that belong to later checkpoints, and the probes for the task exist and pass (a person writes the probe folder: [tests/probes/README.md](../../tests/probes/README.md); the model must never read it, so it is not in the sandbox).

Placeholders: `<sandbox>` and `<run dir>` are the two directories `prepare-local-run` printed; `<baseline sha>` is the baseline it printed (the sandbox's first commit, not a commit of your checkout).

1. **Export the commits the model made** (everything after the baseline), into the run directory, outside the sandbox:

   ```bash
   cd <sandbox>
   git status --short                      # must be empty; if not, the model left work uncommitted: send it back
   git format-patch <baseline sha> --stdout > <run dir>/work.patch
   git apply --stat <run dir>/work.patch   # read it: only the "May touch" files may appear
   ```

2. **Apply it in the worktree you are building in** (the branch named in the plan; a clean tree, except for the untracked probe folder):

   ```bash
   cd <your worktree>
   git rev-parse --short HEAD              # note this: it is the --base for the final check
   git am --3way <run dir>/work.patch
   ```

   The model's commits arrive with their own messages, in order, with the author `kwnto local run <local-run@example.invalid>` and you as the committer. If `git am` stops on a conflict, your branch moved after the sandbox was built: run `git am --abort`, then either rebuild the sandbox from the new HEAD or resolve by hand and `git am --continue`. Never `git apply` over a dirty tree.

3. **Put the probe folder in place** (if it is not already in the worktree) and commit it on its own, for example `test: probes for task 1`. Probes are written by a person or a strong model, never by the local model.

4. **Run the final check in the worktree, not the sandbox.** This is the evidence:

   ```bash
   npm run check:task -- --task <task file> --base <HEAD noted in step 2> --built-by local
   ```

   Paste the full output in the task report: a file `.planning/<date>-<plan>/reports/task-<N>-<checkpoint>.md` holding the commits, your grading notes and the full `check:task` output (the first one to copy is `.planning/2026-11-14-editor-core/reports/task-1-1A.md`). Link it from the progress row. Rows for checkpoints that are not built yet (a later checkpoint's tests) may still show `FAIL coverage`; say so in the report and name the rows.

5. **Record the row** in `progress.md` (Built by `local`, Review, Escaped) and clean up with the `rm -rf` line `prepare-local-run` printed. The patch file lives in `<run dir>`, so it goes with it.

If the fix round is needed (the check or the probes found a problem), send the failures back to the model in the same sandbox as a new prompt in `<run dir>` (`PROMPT-fix1.md`, own `--session-dir`): state the failing input and cause, keep the same "May touch" and "Must not change", ask for the new test first, then a **new** commit (not an amend). After round 2 without a pass, escalate (next section). Then export again from step 1: the patch now holds all commits since the baseline, so apply it to a worktree that does not have the first round yet.

A run that starts but writes no session file and shows an idle GPU and empty slots is stalled: see "The one-minute check".

## When to escalate to a strong model

- The check still shows a `FAIL` after **two rounds** of sending the failures back to the local model.
- The task or checkpoint touches a security-relevant file: access rules, migrations, hooks, `frontend/src/backend/`, anything about sync, conflicts or queues. These are always reviewed ([review-sampling.md](review-sampling.md)) and should not be built locally in the first place.
- The work is debugging a surprising backend or judging a measurement: untested for this model.

Never edit a failing test to get past a FAIL; if a test looks wrong, stop and say so.

## After an interrupted check

If `npm run check:task` was interrupted hard, a deliberate break can be left in a source file: see [After an interrupted run](check-task.md#after-an-interrupted-run).
