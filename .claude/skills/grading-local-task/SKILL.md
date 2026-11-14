---
name: grading-local-task
description: Use when a local-model (little-coder) run on a KWNTO task checkpoint has finished or the developer pastes its report, and its work must be graded, brought into the working branch and recorded. Also when asked to check, accept, apply or record a local model's work, or to fix a failed local run.
---

# Grading and recording local-model work

You are the controller. The local model's report is a claim, not evidence. The rules are in [local-model-runbook.md](../../../docs/developer/local-model-runbook.md) ("After the run", "Bringing the work into the working branch", "When to escalate") and [check-task.md](../../../docs/developer/check-task.md); this skill is the order to do them in. Read the runbook sections if you do not know them.

You never start the model's first run for the developer unless asked. Give them the `little-coder` command to run in their own terminal: runs started from an agent shell stalled (no session file, idle GPU, empty slots) while the same command worked from their terminal.

## Inputs to find first

Sandbox (`/tmp/kwento-local-...`), run directory (`<sandbox>-run/`), baseline sha (the sandbox's first commit: `git -C <sandbox> log --reverse --format=%h | head -1`), task file, checkpoint, and the worktree branch you will apply to.

## Steps

1. **Look at what changed, not what was said.** In the sandbox: `git status --short` (empty), `git log --oneline`, `git diff <baseline> --stat`. Every file must be in the task's "May touch" list; the `Route`-style "Must not change" signatures must be intact.
2. **Run `npm run check:task -- --task <task file> --base <baseline> --built-by local` yourself.** A `FAIL` is acceptable only for rows of later checkpoints (coverage for tests that belong to a checkpoint not built yet); name the rows. A `FAIL probes` for a missing folder is not acceptable: the probes are yours to write (step 4).
3. **Read the session log** (`<run dir>/session*/…jsonl`): the skill was read; tests came before code and the first run failed for the right reason; count of tool calls. For `tests/probes` list each mention and say whether it is the prompt, the plan file, `check:task` output, or a real read:
   ```bash
   node -e "const l=require('fs').readFileSync(process.argv[1],'utf8').split('\n').filter(Boolean).map(JSON.parse);for(const e of l){const s=JSON.stringify(e);if(s.includes('tests/probes'))console.log(e.message?.role,(s.match(/.{80}tests\/probes.{60}/)||[''])[0])}" <session file>
   ```
   A real read voids the probe result: have the probes rewritten by someone else.
4. **Probes.** If `tests/probes/<plan>/<task>/` is missing, write it from the Test plan rows and the kind catalogue in [testing-strategy.md](../../../docs/testing-strategy.md) section 4: one `<row>.probe.test.ts` per row, titles `[C3] kind: description`, a `// Protects:` comment directly above every test, only the imports you use, and only inputs the spec defines (do not assert behaviour the plan leaves open). Run `npm run check:probes -- <folder>` against the sandbox code, and, when you suspect a bug, against the first commit too (a probe that cannot fail proves nothing). Also try edge inputs by hand against the real function.
5. **Decide.**
   - Pass: go to step 6.
   - Failure or bug: send it back. Write `<run dir>/PROMPT-fix<N>.md`: name the failing input and the cause, repeat "May touch" / "Must not change" and "do not read tests/probes/", ask for the new failing test first, then the fix as a **new** commit (no amend), then `check:task`. Own `--session-dir`. Round 2 without a pass, or a security-relevant file: escalate to a strong model.
   - Never edit the model's failing test to make it pass.
7. **Bring it over.** Export, read, apply, in the runbook's order: `git format-patch <baseline> --stdout > <run dir>/work.patch`, `git apply --stat`, note the worktree `HEAD`, `git am --3way`. Commit the probes on their own. Run `check:task` again in the worktree with `--base <HEAD noted>`; that output is the evidence.
8. **Record**, in one closing commit with the plan edits:
   - `.planning/<date>-<plan>/reports/task-<N>-<checkpoint>.md`: commits, grading notes (what you found, fix rounds, probe-read result), the full `check:task` output verbatim, and what is not recorded. Template: the 1A report of plan `2026-11-14-editor-core`.
   - A row in `progress.md` (Built by `local`, Review from the `check:task` line, Escaped), linking the report. Escaped counts problems found **after** the task closed (a bug you found in grading the model's first run counts as 1).
   - Tick the checkpoint's steps in the task file and set the plan README's Status cell.
   - Run `npm run lint` and `npm run report:escape-rate -- <progress.md>` before committing. Do not push.
9. **Later finds.** A bug found after the row was written raises that row's Escaped; edit the old row, do not add a new one.

## Mistakes to avoid

- Believing "failures are expected" without checking each failing row against the task's Test plan.
- Writing the report from the model's summary instead of your own `check:task` run.
- `pkill -f` with a pattern that also matches your own shell (it killed the shell once); kill by PID.
- Applying a patch onto a dirty tree, or over a branch that moved (`git am --abort`, rebuild the sandbox).
- Cleaning up `/tmp` directories before the report is written, or without the developer's say-so.
