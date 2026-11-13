// Checks that plan task files meet the Test plan standard (docs/developer/test-plan-format.md).
// node scripts/check-plan.ts [dir ...]; with no argument it checks every folder under
// docs/superpowers/plans/ whose README.md has the line "**Standard:** test-plan-v1".
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTaskMeta, parseTestPlan } from './lib/test-plan.ts'

const PLANS_DIR = 'docs/superpowers/plans'
const STANDARD_LINE = /^\*\*Standard:\*\* test-plan-v1[ \t]*$/m
const TIERS = ['strong', 'mid', 'local']

export function checkTaskFile(path: string, markdown: string): string[] {
  const problems: string[] = []
  const meta = parseTaskMeta(markdown)
  if (meta.tier === null) problems.push('missing or invalid "**Model tier:**" line (strong, mid or local)')
  if (!meta.hasInterfaces) problems.push('missing "**Interfaces:**" line or block (write `none` if there are none)')
  for (const match of markdown.matchAll(/^\*\*Checkpoint (\S+) tier:\*\*[ \t]*(\S*)/gm)) {
    if (!TIERS.includes(match[2])) problems.push(`"**Checkpoint ${match[1]} tier:**" must be strong, mid or local`)
  }
  problems.push(...parseTestPlan(markdown).problems)
  return problems.map((problem) => `${path}: ${problem}`)
}

export function taskFiles(dir: string): string[] {
  return readdirSync(dir).filter((name) => /^task-.*\.md$/.test(name)).sort()
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

if (import.meta.filename === process.argv[1]) {
  const requested = process.argv.slice(2)
  const folders = requested.length > 0 ? requested : defaultPlanFolders()
  const problems = folders.flatMap(checkPlanFolder)
  if (problems.length > 0) {
    console.log(problems.join('\n'))
    process.exit(1)
  }
  const count = folders.reduce((total, dir) => total + taskFiles(dir).length, 0)
  console.log(`check:plan: ${count} task files ok`)
}
