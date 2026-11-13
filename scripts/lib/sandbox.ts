// The effects of prepare-local-run: reading the checkout's state and building the sandbox.
// Every command runs without a shell. Nothing here deletes anything; the caller removes only what it created.
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'

// Git variables a hook or a worktree can set would point the sandbox's git at the wrong repository.
const DROPPED = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_COMMON_DIR', 'GIT_PREFIX']
const BIG = 1024 * 1024 * 1024
export const CHECK_TIMEOUT_MS = 10 * 60 * 1000

export type RunCheck = (name: string, cwd: string) => { ok: boolean; output: string }

function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const name of DROPPED) delete env[name]
  return env
}

function run(command: string, args: string[], cwd: string, input?: Buffer): Buffer {
  const result = spawnSync(command, args, { cwd, env: cleanEnv(), input, maxBuffer: BIG })
  if (result.error) throw new Error(`cannot run ${command}: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr.toString().trim()}`)
  return result.stdout
}

const git = (cwd: string, ...args: string[]): string => run('git', args, cwd).toString().trim()

export function repoTop(cwd: string): string {
  return git(cwd, 'rev-parse', '--show-toplevel')
}

// Tracked files that differ from HEAD (staged or not), and untracked files not ignored.
export function checkoutState(root: string): { tracked: string[]; untracked: string[] } {
  const tokens = run('git', ['status', '--porcelain', '-z', '--untracked-files=all'], root).toString().split('\0')
  const tracked: string[] = []
  const untracked: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const entry = tokens[i]
    if (entry.length < 4) continue
    const code = entry.slice(0, 2)
    const path = entry.slice(3)
    if (code === '??') untracked.push(path)
    else if (code !== '!!') tracked.push(path)
    if (/[RC]/.test(code)) i++ // a rename or copy is followed by its old path
  }
  return { tracked, untracked }
}

export function inHead(root: string, path: string): boolean {
  const result = spawnSync('git', ['cat-file', '-e', `HEAD:${path}`], { cwd: root, env: cleanEnv() })
  return result.status === 0
}

// Builds the sandbox from HEAD: files only, a fresh repository with no remote, one baseline commit, and
// node_modules linked from the real checkout. Returns the baseline sha. Throws on any failure; the caller
// removes the directory it asked for.
export function createSandbox(root: string, sandbox: string): string {
  mkdirSync(sandbox)
  const files = run('git', ['archive', '--format=tar', 'HEAD'], root)
  run('tar', ['-x', '-C', sandbox], root, files)
  git(sandbox, 'init', '-q')
  // Identity in this repository's own config only: the global config is not touched.
  git(sandbox, 'config', 'user.name', 'kwnto local run')
  git(sandbox, 'config', 'user.email', 'local-run@example.invalid')
  git(sandbox, 'config', 'commit.gpgsign', 'false')
  git(sandbox, 'add', '-A')
  git(sandbox, 'commit', '-q', '--no-verify', '-m', 'baseline')
  const sha = git(sandbox, 'rev-parse', 'HEAD')
  // A symlink is not matched by the "node_modules/" ignore line, so keep it out of git status here.
  appendFileSync(join(sandbox, '.git', 'info', 'exclude'), 'node_modules\n')
  symlinkSync(join(root, 'node_modules'), join(sandbox, 'node_modules'))
  return sha
}

export const realRunCheck: RunCheck = (name, cwd) => {
  const result = spawnSync('npm', ['run', name], { cwd, env: cleanEnv(), encoding: 'utf8', timeout: CHECK_TIMEOUT_MS, maxBuffer: BIG })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `\ncannot run npm: ${result.error.message}` : ''}`
  return { ok: result.status === 0 && !result.error, output }
}

// Runs lint and typecheck in the sandbox. Returns the failures (empty means a clean baseline). A check that
// leaves files behind is a failure too: the model would be graded on them.
export function confirmBaseline(sandbox: string, runCheck: RunCheck): string[] {
  const failures: string[] = []
  for (const name of ['lint', 'typecheck']) {
    const result = runCheck(name, sandbox)
    if (!result.ok) failures.push(`npm run ${name} failed in the sandbox:\n${result.output.trimEnd().split('\n').slice(-20).join('\n')}`)
  }
  const left = checkoutState(sandbox)
  if (left.tracked.length + left.untracked.length > 0) {
    failures.push(`the baseline checks left changes in the sandbox: ${[...left.tracked, ...left.untracked].slice(0, 10).join(', ')}`)
  }
  return failures
}
