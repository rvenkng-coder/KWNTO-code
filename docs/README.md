# KWNTO Documentation

## For people

| Category | File | Description |
|---|---|---|
| **Spec** | [Design](superpowers/specs/2026-11-11-kwnto-design.md) | Product design and architecture |
| **Spec** | [ERD](superpowers/specs/2026-11-11-kwnto-erd.md) | Entity-relationship diagram |
| **Engineering** | [engineering.md](engineering.md) | Coding principles and conventions |
| **Security** | [security.md](security.md) | Security rules and policies |
| **Testing** | [testing-strategy.md](testing-strategy.md) | Test layers, conventions, awkward-case catalogue, definition of done |
| **Testing** | [test-plan.md](test-plan.md) | Per-feature test layers and status, manual sign-off checklist |
| **User** | [user-requirements.md](user-requirements.md) | User requirements |
| **User** | [accounts-and-teams.md](user/accounts-and-teams.md) | Sign up, verify, sign in, teams, invites |
| **Admin** | [settings.md](admin/settings.md) | System settings: every field, its default and what it does |
| **Admin** | [deployment.md](admin/deployment.md) | Deploying on the VM: first run, Tailscale, mail, backups, restore, updating, the first walk |
| **Developer** | [getting-started.md](developer/getting-started.md) | Setup and first run |
| **Developer** | [architecture.md](developer/architecture.md) | How the system fits together |
| **Developer** | [maintaining.md](developer/maintaining.md) | Working on the project by hand: commands, production, where to look |
| **Developer** | [workflow.md](developer/workflow.md) | From branch to production, the kinds of test, the CI jobs |
| **Developer** | [recipes.md](developer/recipes.md) | Which files to change for a new field, collection or backend service |
| **Developer** | [testing.md](developer/testing.md) | Test layers and commands |
| **Developer** | [backend.md](developer/backend.md) | Backend development notes |
| **Developer** | [styling.md](developer/styling.md) | Theme tokens, shared classes, the no-hex rule |
| **User** | [editor.md](user/editor.md) | The editor: projects, chapters, canvas, script, undo, search, working together, working offline |
| **User** | [sharing.md](user/sharing.md) | Share a project by link: view, comment or edit; live or snapshot; republish and revoke |
| **User** | [player.md](user/player.md) | Player Mode: playing through a story |
| **Developer** | [editor.md](developer/editor.md) | Editor model and store, how an edit travels, the offline outbox and sync engine |
| **Developer** | [project-file.md](developer/project-file.md) | The project import and export file |
| **Developer** | [quality-limits.md](developer/quality-limits.md) | Function length, complexity and other limits on changed files, `check:quality` |
| **Developer** | [lint.md](developer/lint.md) | Lint configuration |
| **Decisions** | [0001-toolchain.md](decisions/0001-toolchain.md) | Toolchain decisions |
| **Decisions** | [0002-realtime-spike.md](decisions/0002-realtime-spike.md) | Real-time spike results and the Plan 3 production check |
| **Decisions** | [0003-canvas-performance.md](decisions/0003-canvas-performance.md) | Canvas performance at 500 nodes |
| **Decisions** | [0004-deployment-images.md](decisions/0004-deployment-images.md) | Container images of the deployment |
| **Decisions** | [0005-export-libraries.md](decisions/0005-export-libraries.md) | The three export libraries |
| **Decisions** | [0006-formatter.md](decisions/0006-formatter.md) | Prettier for code layout |

What is built and what comes next: the [roadmap](superpowers/plans/README.md).

## Agent workflow

Only needed when a task is given to an AI agent or a local model. The rules for agents are in [AGENTS.md](../AGENTS.md).

| Category | File | Description |
|---|---|---|
| **Developer** | [test-plan-format.md](developer/test-plan-format.md) | The per-task Test plan block and `check:plan` |
| **Developer** | [check-task.md](developer/check-task.md) | `check:task`, the self-check every task ends with, and how to read its report |
| **Developer** | [local-model-runbook.md](developer/local-model-runbook.md) | Handing a task to the local model: ping the server, start the run, check the result, when to escalate |
| **Developer** | [prepare-local-run.md](developer/prepare-local-run.md) | `prepare-local-run`: builds the sandbox and prompt for one local-model checkpoint and prints the command to start it |
| **Developer** | [review-sampling.md](developer/review-sampling.md) | Which local-model tasks get a person's review, and the escape rate |
| **Developer** | [local-model-notes.md](developer/local-model-notes.md) | Notes for local model usage |
