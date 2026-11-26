// The pure parts of prepare-local-run (docs/developer/prepare-local-run.md): arguments, picking the task
// file and the checkpoint, reading the "Sized for the local model" block, building the prompt and the
// final summary. No file, process or network access here; the effects live in sandbox.ts.
import { parseArgs as parseModelUrl, DEFAULT_URL } from '../ping-local-model.ts'
import { checkTaskFile } from '../check-plan.ts'
import { parseTaskMeta } from './test-plan.ts'

export const USAGE =
  'usage: node scripts/prepare-local-run.ts <plan folder> <task number> [<checkpoint>] [--model-url <url>] [--out <dir>] [--no-ping] [--cwd <dir>]'
const VALUE_OPTIONS = ['--model-url', '--out', '--cwd']
const LOCAL_HEADING = '## Sized for the local model'

export interface Options {
  planDir: string
  task: number
  checkpoint: string | null
  modelUrl: string
  out: string | null
  noPing: boolean
  cwd: string
}
export interface LocalBlock {
  mayTouch: string
  mustNotChange: string
  checkpointGiven: string
}
export interface PromptInput {
  sandbox: string
  checkpoint: string
  taskFile: string
  mayTouch: string
  mustNotChange: string
  baseSha: string
}

// Messages are fixed text: an argument is never echoed, because it can carry a password.
export function parseArgs(argv: string[], defaultCwd: string = process.cwd()): Options | { error: string } {
  const positionals: string[] = []
  const values = new Map<string, string>()
  let noPing = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--no-ping') {
      if (noPing) return { error: 'an option is given twice' }
      noPing = true
    } else if (VALUE_OPTIONS.includes(arg)) {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('-')) return { error: `${arg} needs a value` }
      if (values.has(arg)) return { error: 'an option is given twice' }
      values.set(arg, value)
      i++
    } else if (arg.startsWith('-')) {
      return { error: 'unknown option' }
    } else {
      positionals.push(arg)
    }
  }
  return buildOptions(positionals, values, noPing, defaultCwd)
}

const isCheckpointId = (text: string | null): boolean => text === null || /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(text)

function buildOptions(
  positionals: string[],
  values: Map<string, string>,
  noPing: boolean,
  defaultCwd: string,
): Options | { error: string } {
  if (positionals.length < 2 || positionals.length > 3)
    return { error: 'expected a plan folder, a task number and at most one checkpoint' }
  const [planDir, task, checkpoint = null] = positionals
  if (!/^[1-9]\d*$/.test(task)) return { error: 'the task must be a number such as 3' }
  if (!isCheckpointId(checkpoint)) return { error: 'the checkpoint must be an id such as 3A' }
  const url = values.get('--model-url') ?? DEFAULT_URL
  const parsedUrl = parseModelUrl([url])
  if ('error' in parsedUrl) return { error: `--model-url: ${parsedUrl.error}` }
  return {
    planDir,
    task: Number(task),
    checkpoint,
    modelUrl: parsedUrl.url,
    out: values.get('--out') ?? null,
    noPing,
    cwd: values.get('--cwd') ?? defaultCwd,
  }
}

// The task file `task-<n>-*.md`: exactly one, or an error that names what was found.
export function selectTaskFile(files: string[], task: number): { file: string } | { error: string } {
  const matches = files.filter((name) => name.startsWith(`task-${task}-`) && name.endsWith('.md')).sort()
  if (matches.length === 1) return { file: matches[0] }
  if (matches.length === 0)
    return {
      error: `no task file task-${task}-*.md in the plan folder (task files there: ${files.join(', ') || 'none'})`,
    }
  return { error: `task ${task} matches ${matches.length} files, expected one: ${matches.join(', ')}` }
}

// Lines of the task file without code fences and whole-line HTML comments (the template's notes and examples).
export function noteFreeLines(markdown: string): string[] {
  let fenced = false
  return markdown
    .replaceAll('\r\n', '\n')
    .split('\n')
    .filter((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced
        return false
      }
      return !fenced && !/^\s*<!--.*-->\s*$/.test(line)
    })
}

export function listCheckpoints(markdown: string): string[] {
  return noteFreeLines(markdown).flatMap((line) => {
    const id = /^## Checkpoint (\S+?):/.exec(line)?.[1]
    return id === undefined ? [] : [id]
  })
}

// The checkpoint to give: the one asked for, or the only one. The local model gets one checkpoint per run.
export function selectCheckpoint(ids: string[], requested: string | null): { id: string } | { error: string } {
  if (ids.length === 0) return { error: 'the task file has no "## Checkpoint <id>: ..." heading' }
  if (requested === null) {
    return ids.length === 1
      ? { id: ids[0] }
      : {
          error: `the task has several checkpoints (${ids.join(', ')}); name the one to give, because the local model gets one per run`,
        }
  }
  const count = ids.filter((id) => id === requested).length
  if (count === 0) return { error: `the task has no checkpoint "${requested}" (it has: ${ids.join(', ')})` }
  if (count > 1) return { error: `the checkpoint "${requested}" appears ${count} times in the task file` }
  return { id: requested }
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The tier of one checkpoint: its own "**Checkpoint <id> tier:**" line, else the task's tier.
export function checkpointTier(markdown: string, id: string): string | null {
  const own = new RegExp(`^\\*\\*Checkpoint ${escapeRegExp(id)} tier:\\*\\*[ \\t]*(\\S+)`)
  for (const line of noteFreeLines(markdown)) {
    const token = own.exec(line)?.[1]
    if (token !== undefined) return ['strong', 'mid', 'local'].includes(token) ? token : null
  }
  return parseTaskMeta(markdown).tier
}

// The values of the block's parts, or null when the task has no block.
export function readLocalBlock(markdown: string): LocalBlock | null {
  const lines = noteFreeLines(markdown)
  const start = lines.findIndex((line) => line.trimEnd() === LOCAL_HEADING)
  if (start === -1) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => /^##\s/.test(line))
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n')
  const part = (label: string): string =>
    new RegExp(`^\\*\\*${label}:\\*\\*[ \\t]*(.*\\S)`, 'm').exec(body)?.[1].trim() ?? ''
  return {
    mayTouch: part('May touch'),
    mustNotChange: part('Must not change'),
    checkpointGiven: part('Checkpoint given'),
  }
}

// Everything that makes a checkpoint not fit for the local model. An empty list means go ahead.
export function localRunProblems(path: string, markdown: string, checkpoint: string): string[] {
  const problems = checkTaskFile(path, markdown)
  const tier = checkpointTier(markdown, checkpoint)
  if (tier !== 'local')
    problems.unshift(
      `${path}: checkpoint ${checkpoint} has tier ${tier ?? 'unknown'}: this task is not for the local model`,
    )
  const given = readLocalBlock(markdown)?.checkpointGiven
  if (given && !new RegExp(`\\b${escapeRegExp(checkpoint)}\\b`).test(given)) {
    problems.push(`${path}: "Checkpoint given" says "${given}", which does not name checkpoint ${checkpoint}`)
  }
  return problems
}

export function buildPrompt(input: PromptInput): string {
  return [
    'First, use the local-task skill.',
    `You are working in ${input.sandbox}. Work only inside this folder, with relative paths.`,
    `Do Checkpoint ${input.checkpoint} of ${input.taskFile}. Read that file and the files it links first.`,
    `You may touch only: ${input.mayTouch}`,
    `You must not change: ${input.mustNotChange}`,
    'If you need to touch anything else, stop and report instead.',
    'Do not read anything under tests/probes/.',
    'Write the failing tests first and watch them fail for the right reason. Never edit an existing test.',
    'Close the checkpoint with one commit. Do not push.',
    `At the end run \`${checkTaskCommand(input.taskFile, input.baseSha)}\` and paste its full output in your report.`,
    '',
  ].join('\n')
}

export const checkTaskCommand = (taskFile: string, baseSha: string): string =>
  `npm run check:task -- --task ${shellQuote(taskFile)} --base ${baseSha}`

// A path as one shell word: left bare when it is plain, otherwise single-quoted.
export function shellQuote(text: string): string {
  return /^[A-Za-z0-9_/.:@%+=,-]+$/.test(text) ? text : `'${text.replaceAll("'", "'\\''")}'`
}

export function defaultSandboxName(planDir: string, task: number, checkpoint: string, now: number): string {
  const safe = (text: string): string => text.replace(/[^A-Za-z0-9._-]/g, '_')
  const plan =
    planDir
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .at(-1) ?? 'plan'
  const stamp = new Date(now)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z')
  return `kwnto-local-${safe(plan)}-task${task}-${safe(checkpoint)}-${stamp}`
}

// The block the developer copies. Printed last. The commands are shown, never run.
export function readyBlock(sandbox: string, runDir: string, baseSha: string, taskFile: string): string[] {
  const promptFile = `${runDir}/PROMPT.md`
  const start = `cd ${shellQuote(sandbox)} && little-coder -p --session-dir ${shellQuote(`${runDir}/session`)} --skill .pi/skills/local-task "$(cat ${shellQuote(promptFile)})"`
  return [
    'Ready. Copy this block.',
    `sandbox:      ${sandbox}`,
    `baseline sha: ${baseSha}`,
    `prompt file:  ${promptFile}`,
    'start the run (nothing was started):',
    start,
    `after the run: in the sandbox run \`${checkTaskCommand(taskFile, baseSha)}\`, then read the session log for an early read of SKILL.md, tests written before code, and any read of tests/probes/.`,
    `clean up when done: rm -rf ${shellQuote(sandbox)} ${shellQuote(runDir)}   (printed only, never run for you)`,
  ]
}
