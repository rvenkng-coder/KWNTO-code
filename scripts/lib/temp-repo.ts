// Test helper: a throwaway git repository in a temp dir whose path contains a space.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

export function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  return result.stdout.trim()
}

export function writeIn(cwd: string, path: string, content: string): void {
  mkdirSync(dirname(join(cwd, path)), { recursive: true })
  writeFileSync(join(cwd, path), content)
}

export function makeRepo(files: Record<string, string>): { cwd: string; base: string } {
  const cwd = mkdtempSync(join(tmpdir(), 'hygiene repo-'))
  git(cwd, 'init', '-q')
  git(cwd, 'config', 'user.email', 't@example.com')
  git(cwd, 'config', 'user.name', 't')
  git(cwd, 'config', 'commit.gpgsign', 'false')
  for (const [path, content] of Object.entries(files)) writeIn(cwd, path, content)
  git(cwd, 'add', '-A')
  git(cwd, 'commit', '-q', '-m', 'base')
  return { cwd, base: git(cwd, 'rev-parse', 'HEAD') }
}
