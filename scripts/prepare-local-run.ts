// Prepares one checkpoint for the local model: checks the model server, the task and the checkout, builds
// the sandbox, confirms its baseline, writes the prompt and prints the command to start the run.
// node scripts/prepare-local-run.ts <plan folder> <task> [<checkpoint>] [--model-url <url>] [--out <dir>] [--no-ping]
// It never starts the model and never deletes anything it did not create. Exit 0 ready, 1 a check failed, 2 usage.
// Steps and messages: docs/developer/prepare-local-run.md
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { taskFiles } from './check-plan.ts'
import { formatPing, pingModelServer, type PingResult } from './ping-local-model.ts'
import { isMain } from './lib/is-main.ts'
import {
  buildPrompt,
  defaultSandboxName,
  listCheckpoints,
  localRunProblems,
  type Options,
  parseArgs,
  readLocalBlock,
  readyBlock,
  selectCheckpoint,
  selectTaskFile,
  USAGE,
} from './lib/local-run.ts'
import {
  checkoutState,
  confirmBaseline,
  createSandbox,
  inHead,
  pathTaken,
  realLocation,
  realRunCheck,
  type RunCheck,
  repoTop,
  SandboxError,
} from './lib/sandbox.ts'

export interface Deps {
  ping: (url: string) => Promise<PingResult>
  runCheck: RunCheck
  now: () => number
  create?: (root: string, sandbox: string) => string
}
export interface Outcome {
  code: number
  lines: string[]
}
interface Task {
  root: string
  taskRel: string
  markdown: string
  checkpoint: string
  mayTouch: string
  mustNotChange: string
}
interface Fail {
  fail: string[]
}

const SKILL = '.pi/skills/local-task/SKILL.md'
const failed = (...lines: string[]): Outcome => ({ code: 1, lines })
const isFail = (value: object): value is Fail => 'fail' in value
const inside = (root: string, path: string): boolean => {
  const rel = relative(root, path)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

export const realDeps: Deps = { ping: (url) => pingModelServer(url), runCheck: realRunCheck, now: Date.now }

// Step 1. Returns the lines to print and whether to stop.
async function pingStep(options: Options, deps: Deps): Promise<{ lines: string[]; stop: boolean }> {
  if (options.noPing) return { lines: ['model server: ping skipped (--no-ping)'], stop: false }
  const result = await deps.ping(options.modelUrl)
  const line = formatPing(result)
  if (!result.ok)
    return { lines: [line, 'Not started. Start or restart llama-swap first, then run this again.'], stop: true }
  return {
    lines: result.loaded
      ? [line]
      : [line, 'warning: the model is idle, so the first request will be slow while it loads.'],
    stop: false,
  }
}

// The checkout root and the plan folder inside it, or what went wrong.
function locatePlan(options: Options): { root: string; dir: string } | Fail {
  let root: string
  let dir: string
  try {
    root = realpathSync(repoTop(options.cwd))
    dir = realpathSync(resolve(options.cwd, options.planDir))
  } catch {
    return { fail: ['cannot find the plan folder inside a git checkout (run from the repo, or pass --cwd)'] }
  }
  if (!inside(root, dir)) return { fail: [`the plan folder ${options.planDir} is not inside the checkout ${root}`] }
  return { root, dir }
}

// Step 2, the reading half: the plan folder, the one task file, the one checkpoint, and the block's values.
function resolveTask(options: Options): Task | Fail {
  const located = locatePlan(options)
  if (isFail(located)) return located
  const { root, dir } = located
  let files: string[]
  let markdown: string
  let taskRel: string
  try {
    files = taskFiles(dir)
  } catch {
    return { fail: [`cannot read the plan folder ${options.planDir}`] }
  }
  const picked = selectTaskFile(files, options.task)
  if ('error' in picked) return { fail: [`${options.planDir}: ${picked.error}`] }
  try {
    taskRel = relative(root, join(dir, picked.file)).split('\\').join('/')
    markdown = readFileSync(join(root, taskRel), 'utf8')
  } catch {
    return { fail: [`cannot read the task file ${picked.file}`] }
  }
  const checkpoint = selectCheckpoint(listCheckpoints(markdown), options.checkpoint)
  if ('error' in checkpoint) return { fail: [`${taskRel}: ${checkpoint.error}`] }
  const block = readLocalBlock(markdown)
  return {
    root,
    taskRel,
    markdown,
    checkpoint: checkpoint.id,
    mayTouch: block?.mayTouch ?? '',
    mustNotChange: block?.mustNotChange ?? '',
  }
}

// Step 3: the sandbox is built from HEAD, so HEAD must hold what the model needs.
function checkoutProblems(task: Task): { problems: string[]; warnings: string[] } {
  let state: { tracked: string[]; untracked: string[] }
  try {
    state = checkoutState(task.root)
  } catch (error) {
    return {
      problems: [`cannot read the state of the checkout: ${error instanceof Error ? error.message : 'unknown error'}`],
      warnings: [],
    }
  }
  const problems: string[] = []
  if (state.tracked.length > 0) {
    problems.push(
      `the checkout has uncommitted changes to tracked files, and the sandbox is built from HEAD, so the model would not see them. Commit or stash: ${state.tracked.slice(0, 10).join(', ')}`,
    )
  }
  if (!inHead(task.root, task.taskRel)) problems.push(`${task.taskRel} is not committed (HEAD does not have it)`)
  if (!inHead(task.root, SKILL))
    problems.push(`HEAD does not have ${SKILL}, so the sandbox would have no local-task skill`)
  if (!existsSync(join(task.root, 'node_modules')))
    problems.push(`${join(task.root, 'node_modules')} does not exist: run npm install in the checkout first`)
  const warnings =
    state.untracked.length === 0
      ? []
      : [
          `warning: untracked files are not in the sandbox: ${state.untracked.slice(0, 10).join(', ')}${state.untracked.length > 10 ? ', ...' : ''}`,
        ]
  return { problems, warnings }
}

// Where the sandbox and its run directory go. Neither may exist (a dangling symlink counts as existing), and
// the sandbox must be outside the checkout by real path, so a symlinked --out cannot lead back into it.
function placeFor(options: Options, task: Task, deps: Deps): { sandbox: string; runDir: string } | Fail {
  const wanted =
    options.out === null
      ? join(tmpdir(), defaultSandboxName(options.planDir, options.task, task.checkpoint, deps.now()))
      : resolve(options.cwd, options.out)
  const sandbox = realLocation(wanted)
  const runDir = `${sandbox}-run`
  if (inside(task.root, sandbox) || sandbox === task.root)
    return { fail: [`${wanted} is inside the working checkout: pick a directory outside it with --out`] }
  for (const path of [wanted, sandbox, runDir]) {
    if (pathTaken(path))
      return { fail: [`${path} already exists: nothing was created. Pick another --out, or remove it yourself.`] }
  }
  if (!existsSync(dirname(sandbox)))
    return { fail: [`the folder ${dirname(sandbox)} does not exist: nothing was created`] }
  return { sandbox, runDir }
}

const reason = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error')

// Step 4. Removes the sandbox only when createSandbox says its own mkdir made it.
function makeSandbox(task: Task, sandbox: string, deps: Deps): { sha: string } | Fail {
  try {
    return { sha: (deps.create ?? createSandbox)(task.root, sandbox) }
  } catch (error) {
    const created = error instanceof SandboxError && error.created
    if (created) rmSync(sandbox, { recursive: true, force: true })
    return {
      fail: [
        `cannot build the sandbox: ${reason(error)}`,
        created ? `removed the directory it created: ${sandbox}` : `it created nothing and removed nothing: ${sandbox}`,
      ],
    }
  }
}

// Step 6. The run directory is removed only if this call made it; the sandbox was made by this run.
function writePrompt(task: Task, place: { sandbox: string; runDir: string }, sha: string): string[] | null {
  let runCreated = false
  try {
    mkdirSync(place.runDir)
    runCreated = true
    mkdirSync(join(place.runDir, 'session'))
    const prompt = buildPrompt({
      sandbox: place.sandbox,
      checkpoint: task.checkpoint,
      taskFile: task.taskRel,
      mayTouch: task.mayTouch,
      mustNotChange: task.mustNotChange,
      baseSha: sha,
    })
    writeFileSync(join(place.runDir, 'PROMPT.md'), prompt)
    return null
  } catch (error) {
    if (runCreated) rmSync(place.runDir, { recursive: true, force: true })
    rmSync(place.sandbox, { recursive: true, force: true })
    return [
      `cannot write the prompt: ${reason(error)}`,
      `removed what this run created: ${place.sandbox}${runCreated ? ` and ${place.runDir}` : ''}`,
    ]
  }
}

// Steps 4 to 6 after the placing: build, confirm the baseline, write the prompt.
function build(task: Task, place: { sandbox: string; runDir: string }, deps: Deps): Outcome & { sha?: string } {
  const made = makeSandbox(task, place.sandbox, deps)
  if (isFail(made)) return failed(...made.fail)
  const lines = [`sandbox built from HEAD at ${place.sandbox} (baseline ${made.sha}, no remote)`]
  let baseline: string[]
  try {
    baseline = confirmBaseline(place.sandbox, deps.runCheck)
  } catch {
    baseline = ['could not confirm the baseline (a check could not run)']
  }
  if (baseline.length > 0)
    return failed(
      ...baseline,
      `The sandbox was left in place for you to look at: ${place.sandbox}`,
      'Nothing else was created.',
    )
  lines.push('baseline: npm run lint and npm run typecheck are clean in the sandbox')
  const problem = writePrompt(task, place, made.sha)
  return problem ? failed(...problem) : { code: 0, lines, sha: made.sha }
}

async function prepare(argv: string[], deps: Deps): Promise<Outcome> {
  const options = parseArgs(argv)
  if ('error' in options) return { code: 2, lines: [options.error, USAGE] }
  const ping = await pingStep(options, deps)
  if (ping.stop) return failed(...ping.lines)
  const lines = [...ping.lines]
  const task = resolveTask(options)
  if (isFail(task)) return failed(...lines, ...task.fail)
  const problems = localRunProblems(task.taskRel, task.markdown, task.checkpoint)
  if (problems.length > 0)
    return failed(...lines, ...problems, 'Not started: fix the task file, or give this checkpoint to a stronger model.')
  lines.push(
    `task ${options.task}, checkpoint ${task.checkpoint}: tier local, "Sized for the local model" block complete`,
  )
  const checkout = checkoutProblems(task)
  if (checkout.problems.length > 0)
    return failed(...lines, ...checkout.problems, ...checkout.warnings, 'Not started: nothing was created.')
  lines.push(...checkout.warnings)
  const place = placeFor(options, task, deps)
  if (isFail(place)) return failed(...lines, ...place.fail)
  const built = build(task, place, deps)
  if (built.code !== 0 || built.sha === undefined) return failed(...lines, ...built.lines)
  return {
    code: 0,
    lines: [...lines, ...built.lines, '', ...readyBlock(place.sandbox, place.runDir, built.sha, task.taskRel)],
  }
}

// Whatever goes wrong, the developer gets one fixed line and an exit code, never a stack or a URL.
export async function runPrepare(argv: string[], deps: Deps = realDeps): Promise<Outcome> {
  try {
    return await prepare(argv, deps)
  } catch {
    return failed(
      'prepare-local-run: stopped by an unexpected error (details are not printed). Look for a sandbox or run directory it may have left, and remove it yourself if it is yours.',
    )
  }
}

if (isMain(import.meta.filename)) {
  const { code, lines } = await runPrepare(process.argv.slice(2))
  for (const line of lines) (code === 0 ? console.log : console.error)(line)
  process.exit(code)
}
