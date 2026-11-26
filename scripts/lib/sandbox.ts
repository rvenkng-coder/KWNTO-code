// The effects of prepare-local-run: reading the checkout's state and building the sandbox.
// Every command runs without a shell. Nothing here deletes anything; the caller removes only what it created.
import { spawnSync } from 'node:child_process'
import { appendFileSync, lstatSync, mkdirSync, realpathSync, symlinkSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

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

// For every process run in the sandbox: neither the system nor the global git config is read, so the
// developer's hooks, credential helpers and URL rewrites do not apply there. Identity is in the local config.
function isolatedEnv(): NodeJS.ProcessEnv {
  return { ...cleanEnv(), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
}

// Thrown by createSandbox. `created` says whether its own mkdir made the directory: only then may a caller remove it.
export class SandboxError extends Error {
  readonly created: boolean
  constructor(message: string, created: boolean) {
    super(message)
    this.created = created
  }
}

function run(
  command: string,
  args: string[],
  cwd: string,
  input?: Buffer,
  env: NodeJS.ProcessEnv = cleanEnv(),
): Buffer {
  const result = spawnSync(command, args, { cwd, env, input, maxBuffer: BIG })
  if (result.error) throw new Error(`cannot run ${command}: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr.toString().trim()}`)
  return result.stdout
}

const git = (cwd: string, ...args: string[]): string => run('git', args, cwd).toString().trim()
const sandboxGit = (cwd: string, ...args: string[]): string =>
  run('git', args, cwd, undefined, isolatedEnv()).toString().trim()

export function repoTop(cwd: string): string {
  return git(cwd, 'rev-parse', '--show-toplevel')
}

// Tracked files that differ from HEAD (staged or not), and untracked files not ignored.
export function checkoutState(root: string, isolated = false): { tracked: string[]; untracked: string[] } {
  const tokens = run(
    'git',
    ['status', '--porcelain', '-z', '--untracked-files=all'],
    root,
    undefined,
    isolated ? isolatedEnv() : cleanEnv(),
  )
    .toString()
    .split('\0')
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

// True when something is at the path, a dangling symlink included (existsSync follows links and says no).
export function pathTaken(path: string): boolean {
  try {
    lstatSync(path)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ENOENT' // any other error: treat as taken, fail closed
  }
}

// The real location of a path that may not exist yet: its nearest existing ancestor, resolved, plus the rest.
export function realLocation(path: string): string {
  const rest: string[] = []
  for (let dir = path; ; dir = dirname(dir)) {
    try {
      return join(realpathSync(dir), ...rest)
    } catch {
      if (dirname(dir) === dir) return path
      rest.unshift(basename(dir))
    }
  }
}

// Builds the sandbox from HEAD: files only, a fresh repository with no remote, one baseline commit, and
// node_modules linked from the real checkout. Returns the baseline sha. Throws a SandboxError; its `created`
// flag is true only when this call made the directory, so the caller removes nothing it did not create.
export function createSandbox(root: string, sandbox: string): string {
  try {
    mkdirSync(sandbox)
  } catch (error) {
    throw new SandboxError(`cannot create ${sandbox}: ${(error as NodeJS.ErrnoException).code ?? 'error'}`, false)
  }
  try {
    return fillSandbox(root, sandbox)
  } catch (error) {
    throw new SandboxError(error instanceof Error ? error.message : 'unknown error', true)
  }
}

function fillSandbox(root: string, sandbox: string): string {
  const files = run('git', ['archive', '--format=tar', 'HEAD'], root)
  run('tar', ['-x', '-C', sandbox], root, files)
  const git = (...args: string[]): string => sandboxGit(sandbox, ...args)
  git('init', '-q')
  // Guard rails in this repository's own config, set before the first commit. No hook runs (an empty hooks
  // folder), no transport can push, no credential helper answers, and the identity is local.
  const hooks = join(sandbox, '.git', 'no-hooks')
  mkdirSync(hooks)
  git('config', 'core.hooksPath', hooks)
  git('config', 'protocol.allow', 'never')
  git('config', 'credential.helper', '')
  git('config', 'user.name', 'kwnto local run')
  git('config', 'user.email', 'local-run@example.invalid')
  git('config', 'commit.gpgsign', 'false')
  git('add', '-A')
  git('commit', '-q', '--no-verify', '-m', 'baseline')
  const sha = git('rev-parse', 'HEAD')
  // A symlink is not matched by the "node_modules/" ignore line, so keep it out of git status here.
  appendFileSync(join(sandbox, '.git', 'info', 'exclude'), 'node_modules\n')
  symlinkSync(join(root, 'node_modules'), join(sandbox, 'node_modules'))
  return sha
}

export const realRunCheck: RunCheck = (name, cwd) => {
  const result = spawnSync('npm', ['run', name], {
    cwd,
    env: isolatedEnv(),
    encoding: 'utf8',
    timeout: CHECK_TIMEOUT_MS,
    maxBuffer: BIG,
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `\ncannot run npm: ${result.error.message}` : ''}`
  return { ok: result.status === 0 && !result.error, output }
}

// Runs lint and typecheck in the sandbox. Returns the failures (empty means a clean baseline). A check that
// leaves files behind is a failure too: the model would be graded on them.
export function confirmBaseline(sandbox: string, runCheck: RunCheck): string[] {
  const failures: string[] = []
  for (const name of ['lint', 'typecheck']) {
    const result = runCheck(name, sandbox)
    if (!result.ok)
      failures.push(
        `npm run ${name} failed in the sandbox:\n${result.output.trimEnd().split('\n').slice(-20).join('\n')}`,
      )
  }
  const left = checkoutState(sandbox, true)
  if (left.tracked.length + left.untracked.length > 0) {
    failures.push(
      `the baseline checks left changes in the sandbox: ${[...left.tracked, ...left.untracked].slice(0, 10).join(', ')}`,
    )
  }
  return failures
}
