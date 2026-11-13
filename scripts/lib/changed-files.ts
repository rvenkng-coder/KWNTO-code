// Shared by check:hygiene, check:quality and check:task: what changed since a base commit.
// Git is run without a shell and with -z output, so paths with spaces or odd characters survive.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface Change { path: string; status: 'added' | 'modified' | 'deleted' | 'renamed'; oldPath?: string }

// Parses `git diff --name-status -M` output: tab-separated lines, or NUL-separated tokens (-z).
export function parseNameStatus(output: string): Change[] {
  const tokens = output.includes('\0')
    ? output.split('\0')
    : output.split('\n').flatMap((line) => (line === '' ? [] : line.split('\t')))
  const changes: Change[] = []
  for (let i = 0; i < tokens.length; i++) {
    const code = tokens[i]
    if (code === '') continue
    const kind = code[0]
    if (kind === 'R' || kind === 'C') {
      const [oldPath, path] = [tokens[i + 1], tokens[i + 2]]
      if (oldPath === undefined || path === undefined) throw new Error(`incomplete rename entry near "${code}"`)
      // A copy leaves the original in place, so the new path is simply an added file.
      changes.push(kind === 'R' ? { path, status: 'renamed', oldPath } : { path, status: 'added' })
      i += 2
      continue
    }
    const path = tokens[i + 1]
    if (path === undefined) throw new Error(`incomplete entry near "${code}"`)
    // T (type change) counts as modified; an unknown code is an error, never skipped.
    const status = { A: 'added', M: 'modified', D: 'deleted', T: 'modified' }[code] as Change['status'] | undefined
    if (status === undefined) throw new Error(`unknown git status "${code}" for ${path}`)
    changes.push({ path, status })
    i += 1
  }
  return changes
}

function git(args: string[], cwd: string, allowFailure = false): string | null {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  if (result.error) throw result.error
  if (result.status !== 0) {
    if (allowFailure) return null
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`)
  }
  return result.stdout
}

// Committed, staged, unstaged and untracked changes of the working tree, relative to base.
export function changedFiles(base: string, cwd: string = process.cwd()): Change[] {
  const diff = git(['diff', '--name-status', '-M', '-z', '--no-ext-diff', base], cwd) as string
  const changes = parseNameStatus(diff)
  const known = new Set(changes.map((change) => change.path))
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'], cwd) as string
  for (const path of untracked.split('\0')) {
    if (path !== '' && !known.has(path)) changes.push({ path, status: 'added' })
  }
  return changes
}

export function fileAtBase(base: string, path: string, cwd: string = process.cwd()): string | null {
  return git(['show', `${base}:./${path}`], cwd, true)
}

// Line numbers (1-based) added in the working copy of `path`. A file new since base: every line.
export function addedLines(base: string, path: string, cwd: string = process.cwd()): Set<number> {
  const lines = new Set<number>()
  if (fileAtBase(base, path, cwd) === null) {
    let text: string
    try {
      text = readFileSync(join(cwd, path), 'utf8')
    } catch {
      return lines // deleted or unreadable: nothing was added
    }
    const count = text === '' ? 0 : text.replace(/\n$/, '').split('\n').length
    for (let n = 1; n <= count; n++) lines.add(n)
    return lines
  }
  const diff = git(['diff', '-U0', '--no-ext-diff', base, '--', path], cwd) as string
  for (const match of diff.matchAll(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(match[1])
    const length = match[2] === undefined ? 1 : Number(match[2])
    for (let n = start; n < start + length; n++) lines.add(n)
  }
  return lines
}
