// Checks that plan task files meet the Test plan standard (docs/developer/test-plan-format.md).
// node scripts/check-plan.ts [dir ...]; with no argument it checks every folder under
// docs/superpowers/plans/ whose README.md has the line "**Standard:** test-plan-v1".
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTaskMeta, parseTestPlan } from './lib/test-plan.ts'
import { isMain } from './lib/is-main.ts'

const PLANS_DIR = 'docs/superpowers/plans'
const STANDARD_LINE = /^\*\*Standard:\*\* test-plan-v1[ \t]*$/m
const TIERS = ['strong', 'mid', 'local']

const LOCAL_HEADING = '## Sized for the local model'
// Each part of the block: a label with text after it on the same line, or (for the stop rule) the sentence.
const LOCAL_PARTS: { name: string; pattern: RegExp }[] = [
  { name: 'May touch', pattern: /^\*\*May touch:\*\*[ \t]*\S/m },
  { name: 'Must not change', pattern: /^\*\*Must not change:\*\*[ \t]*\S/m },
  { name: 'Stop and report', pattern: /^stop and report if you need to touch anything else/im },
  { name: 'Model server', pattern: /^\*\*Model server:\*\*[ \t]*\S/m },
  { name: 'Checkpoint given', pattern: /^\*\*Checkpoint given:\*\*[ \t]*\S/m },
]

// A task (or a checkpoint) for the local tier must carry the "Sized for the local model" block, complete.
function localBlockProblems(markdown: string, tier: string | null): string[] {
  const text = markdown.replaceAll('\r\n', '\n')
  const local = tier === 'local' || /^\*\*Checkpoint \S+ tier:\*\*[ \t]*local\b/m.test(text)
  if (!local) return []
  let fenced = false
  const lines = text.split('\n').filter((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced
      return false
    }
    return !fenced && !/^\s*<!--.*-->\s*$/.test(line)
  })
  const starts = lines.flatMap((line, index) => (line.trimEnd() === LOCAL_HEADING ? [index] : []))
  const missing = `a local-tier task needs the "${LOCAL_HEADING}" block (see TASK-TEMPLATE.md)`
  if (starts.length === 0) return [missing]
  const rest = lines.slice(starts[0] + 1)
  const end = rest.findIndex((line) => /^##\s/.test(line))
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n')
  const problems = LOCAL_PARTS.filter((part) => !part.pattern.test(body)).map(
    (part) => `"${LOCAL_HEADING}" block: "${part.name}" is missing or empty`,
  )
  if (starts.length > 1) problems.push(`the "${LOCAL_HEADING}" heading appears more than once`)
  return problems
}

export function checkTaskFile(path: string, markdown: string): string[] {
  const problems: string[] = []
  const meta = parseTaskMeta(markdown)
  if (meta.tier === null) problems.push('missing or invalid "**Model tier:**" line (strong, mid or local)')
  if (!meta.hasInterfaces) problems.push('missing "**Interfaces:**" line or block (write `none` if there are none)')
  for (const match of markdown.matchAll(/^\*\*Checkpoint (\S+) tier:\*\*[ \t]*(\S*)/gm)) {
    if (!TIERS.includes(match[2])) problems.push(`"**Checkpoint ${match[1]} tier:**" must be strong, mid or local`)
  }
  problems.push(...localBlockProblems(markdown, meta.tier))
  problems.push(...parseTestPlan(markdown).problems)
  return problems.map((problem) => `${path}: ${problem}`)
}

export function taskFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => /^task-.*\.md$/.test(name))
    .sort()
}

export function checkPlanFolder(dir: string): string[] {
  let files: string[]
  try {
    files = taskFiles(dir)
  } catch {
    return [`${dir}: cannot read the folder`]
  }
  if (files.length === 0) return [`${dir}: no task files (task-*.md) found`]
  return files.flatMap((name) => {
    const path = join(dir, name)
    try {
      return checkTaskFile(path, readFileSync(path, 'utf8'))
    } catch {
      return [`${path}: cannot read the file`]
    }
  })
}

// Folders under `root` that opted in with the Standard line. Others (older plans) are not graded.
export function defaultPlanFolders(root: string = PLANS_DIR): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name))
    .filter((dir) => {
      try {
        return STANDARD_LINE.test(readFileSync(join(dir, 'README.md'), 'utf8'))
      } catch {
        return false
      }
    })
}

if (isMain(import.meta.filename)) {
  const requested = process.argv.slice(2)
  let folders: string[]
  try {
    folders = requested.length > 0 ? requested : defaultPlanFolders()
  } catch {
    console.log(`check:plan: cannot read ${PLANS_DIR} (run from the repo root)`)
    process.exit(1)
  }
  const problems = folders.flatMap(checkPlanFolder)
  if (problems.length > 0) {
    console.log(problems.join('\n'))
    process.exit(1)
  }
  const count = folders.reduce((total, dir) => total + taskFiles(dir).length, 0)
  console.log(`check:plan: ${count} task files ok`)
}
