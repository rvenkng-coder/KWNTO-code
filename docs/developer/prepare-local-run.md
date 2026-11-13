# prepare-local-run: one command to hand a checkpoint to the local model

`npm run prepare-local-run` does the preparation of the [runbook](local-model-runbook.md) for you: it checks the server, the task and the checkout, builds the sandbox, confirms its baseline, writes the prompt and prints the command that starts the run. It never starts the model.

## The command

```sh
npm run prepare-local-run -- <plan folder> <task> [<checkpoint>] [--model-url <url>] [--out <dir>] [--no-ping]
```

- `<plan folder>`: a folder inside the checkout, for example `docs/superpowers/plans/2026-11-14-editor-core`.
- `<task>`: the task number N. It must match exactly one `task-N-*.md` file in the folder (none, or several, is an error that names the files).
- `<checkpoint>`: for example `1A`. Left out, the task must have exactly one checkpoint. The local model gets one checkpoint per run; `check:task` grades the whole task.
- `--model-url`: the model server, default `http://localhost:9092`. A URL with a user name or password is refused and never printed.
- `--out`: the sandbox directory. Default: `<tmp>/kwnto-local-<plan>-task<N>-<checkpoint>-<timestamp>`. It must not exist and must be outside the checkout. The prompt and the session folder go in a sibling directory, `<out>-run/`, so the model's repository stays clean.
- `--no-ping`: skip step 1 (the output says so).
- `--cwd <dir>`: treat this directory as the working directory (for tests).

Exit codes: 0 ready, 1 a check failed (a message says which; nothing is created before step 4 passes), 2 a usage error. Any other argument starting with `-` is a usage error.

## The steps, and what each proves

1. **Ping** (`ping:model`'s check). Not answering stops. An idle model is a warning: the first request is slow.
2. **Task file.** Same checks as `check:plan` on that file, plus: the chosen checkpoint's tier must be `local` (else "this task is not for the local model"), the `## Sized for the local model` block must be complete, and its "Checkpoint given" line must name the chosen checkpoint. Every problem is printed.
3. **Checkout.** Refuses uncommitted changes to tracked files (the sandbox is built from HEAD, so the model would not see them), a task file or `.pi/skills/local-task/SKILL.md` missing from HEAD, and a missing `node_modules`. Untracked files are only a warning.
4. **Sandbox.** `git archive HEAD | tar -x`, then `git init`, an identity in that repository's own config (global config untouched), no remote, one baseline commit, and `node_modules` symlinked from the real checkout (excluded in `.git/info/exclude`, so `git status` stays clean). The baseline sha is recorded.
5. **Baseline.** `npm run lint` and `npm run typecheck` in the sandbox must be clean and leave no files behind. The full test suite is not run and Docker is not started.
6. **Prompt.** `PROMPT.md` in the run directory, from the runbook's template, filled from the task file. It starts with `First, use the local-task skill.`, copies the "May touch" and "Must not change" values, ends with the exact `check:task` command, and says not to read `tests/probes/` without naming the probe folder.
7. **The block to copy**: sandbox, baseline sha, prompt file, the `little-coder` command, what to do after the run and the cleanup command.

## What it never does

Start the model, push, add a remote, touch global git config, run Docker, or delete anything it did not create. If it fails after creating the sandbox before step 5 ends, it removes only that directory and says so; if the baseline fails (step 5) it leaves the sandbox in place and prints its path. The cleanup (`rm -rf` of the two directories) is printed for you to run.

## Failure messages

| Message | Meaning |
|---|---|
| `model server: NOT answering: ...` | Start llama-swap, or use `--no-ping` if you know better. |
| `no task file task-N-*.md ...` / `matches 2 files` | The task number is wrong or ambiguous. |
| `several checkpoints (...)` / `no checkpoint "X"` | Name one of the listed checkpoints. |
| `this task is not for the local model` | Tier is `strong` or `mid`. |
| `"<part>" is missing or empty` | The local block is incomplete. |
| `uncommitted changes to tracked files` | Commit or stash; the sandbox is built from HEAD. |
| `already exists` / `inside the working checkout` | Pick another `--out`. |
| `npm run lint failed in the sandbox` | The baseline is not clean; the sandbox is left for you to look at. |
