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
4. **Sandbox.** `git archive HEAD | tar -x`, then `git init` and, in that repository's own config before the first commit: no hooks (an empty hooks folder), `protocol.allow never` (git cannot push or fetch over any transport), an empty `credential.helper`, and a local identity. Every git and npm process run in the sandbox by this command ignores the system and global git config, so the developer's global hooks, credential helpers and URL rewrites do not apply. There is no remote. Then one baseline commit, and `node_modules` symlinked from the real checkout (excluded in `.git/info/exclude`, so `git status` stays clean). The baseline sha is recorded. Two things to know:
   - **`node_modules` is the real one.** The link points at the real checkout's `node_modules` (which can itself be a link into another worktree), so an `npm install`, or any write the model makes under `node_modules/`, lands there, and `tsc -b` writes `node_modules/.tmp/*.tsbuildinfo` into it. The skill tells the model never to touch it; nothing enforces that.
   - **The model sees everything tracked at HEAD**, including `.planning/` and `tests/probes/README.md`. The prompt tells it not to read `tests/probes/`; it is not hidden.
5. **Baseline.** `npm run lint` and `npm run typecheck` in the sandbox must be clean and leave no files behind. The full test suite is not run and Docker is not started.
6. **Prompt.** `PROMPT.md` in the run directory, from the runbook's template, filled from the task file. It starts with `First, use the local-task skill.`, copies the "May touch" and "Must not change" values, ends with the exact `check:task` command, and says not to read `tests/probes/`. The prompt does not name the probe folder, but the task file the model reads does (`**Probe folder:**`).
7. **The block to copy**: sandbox, baseline sha, prompt file, the `little-coder` command, what to do after the run and the cleanup command.

## What it never does

Start the model, push, add a remote, change global git config, run Docker, or delete anything it did not create. Removal rules, exactly:

- Before anything is created, it refuses a `--out` (or `<out>-run`) where anything exists, a dangling symlink included, and a `--out` that reaches the checkout through a symlink.
- If building the sandbox fails, it removes the sandbox directory only if its own `mkdir` made it. A directory it did not make is left alone.
- If the baseline (step 5) fails or cannot run, the sandbox is left in place and its path is printed.
- If writing the prompt (step 6) fails, it removes the run directory (only if it made it) and the sandbox, and says which.
- The cleanup (`rm -rf` of the two directories) is printed for you to run.

**A guard rail, not a security boundary.** Git in the sandbox has no remote, no push-capable protocol, no credential helper and no hooks, and the model could still change that config. Anything the model runs outside git (a shell command, `gh`) can reach the developer's global `gh` login. Run it with that in mind.

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
