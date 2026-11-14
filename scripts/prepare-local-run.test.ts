// Protects the local-model hand-off: the real command, run against a throwaway repository, stops with its
// own message (never a stack) when anything is wrong, creates nothing before the checks pass, and on success
// leaves a remote-less sandbox, a prompt outside its git tree and a start command it does not run.
import { spawn } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { git, makeRepo, writeIn } from './lib/temp-repo.ts'
import { SandboxError } from './lib/sandbox.ts'
import { runPrepare } from './prepare-local-run.ts'

const SCRIPT = join(import.meta.dirname, 'prepare-local-run.ts')
const PLAN = 'docs/superpowers/plans/2026-01-01-demo'
const PASS = 'node -e "process.exit(0)"'
const BLOCK = [
  '## Sized for the local model', '**May touch:** `scripts/a.ts`, `scripts/a.test.ts` (exhaustive)', '**Must not change:** the signature of `a`',
  'Stop and report if you need to touch anything else.', '**Model server:** run `npm run ping:model` first', '**Checkpoint given:** Checkpoint 1A only',
].join('\n')
const TEST_PLAN = [
  '## Test plan', '### Cases', '| ID | Behaviour | Layer | Input | Expected | Test |', '|---|---|---|---|---|---|',
  '| C1 | b | unit | `a()` | `1` | scripts/a.test.ts :: b |', '### Probes', '**Probe folder:** `tests/probes/demo/1/`',
  '### Breaks', '| ID | File | Find | Replace | Tests |', '|---|---|---|---|---|', '| B1 | scripts/a.ts | `a < b` | `a <= b` | scripts/a.test.ts |',
  '### Flow', 'none', '### Evidence', 'the output',
].join('\n')
function taskFile(tier = 'local', block = BLOCK, checkpoints = ['1A']): string {
  const headings = checkpoints.map((id) => `## Checkpoint ${id}: part\n- [ ] step`).join('\n')
  return `# Task 1\n**Model tier:** ${tier}\n**Interfaces:** none\n${block}\n${headings}\n${TEST_PLAN}\n`
}

const cleanup: string[] = []
afterEach(() => { for (const dir of cleanup.splice(0)) rmSync(dir, { recursive: true, force: true }) })

function repo(files: Record<string, string> = {}, lint = PASS): string {
  const pkg = JSON.stringify({ name: 'fake', private: true, scripts: { lint, typecheck: PASS } })
  const { cwd } = makeRepo({
    '.gitignore': 'node_modules/\n', 'package.json': pkg, '.pi/skills/local-task/SKILL.md': 'skill\n',
    [`${PLAN}/task-1-demo.md`]: taskFile(), ...files,
  })
  writeIn(cwd, 'node_modules/.keep', '')
  cleanup.push(cwd)
  return cwd
}
function outPath(): string {
  const parent = mkdtempSync(join(tmpdir(), 'prep out-'))
  cleanup.push(parent)
  return join(parent, 'sand box')
}

interface Result { code: number | null; out: string }
// Async spawn: a throwaway server may live in this process, so a blocking spawn would starve it.
function run(cwd: string, ...args: string[]): Promise<Result> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, '--cwd', cwd, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (chunk: Buffer) => { out += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { out += chunk.toString() })
    child.on('close', (code) => resolve({ code, out }))
  })
}
const go = (cwd: string, extra: string[] = [], task = '1', out = outPath()): Promise<Result> => run(cwd, PLAN, task, '--no-ping', '--out', out, ...extra)
const noStack = (out: string): void => { expect(out).not.toMatch(/\n\s+at |node:internal|TypeError|Error:/) }

describe('prepare-local-run: refusals create nothing', () => {
  async function refused(cwd: string, args: string[], message: RegExp, out = outPath()): Promise<string> {
    const result = await go(cwd, args, '1', out)
    expect(result.code).toBe(1)
    expect(result.out).toMatch(message)
    expect(existsSync(out)).toBe(false)
    expect(existsSync(`${out}-run`)).toBe(false)
    noStack(result.out)
    return result.out
  }

  // Protects: a task number with no file is an error that lists the files the folder has.
  test('task not found', async () => {
    const result = await go(repo(), [], '7')
    expect(result.code).toBe(1)
    expect(result.out).toMatch(/no task file task-7-\*\.md.*task-1-demo\.md/)
    noStack(result.out)
  })

  // Protects: two files for one task number are an error that names both, never a silent pick of one.
  test('two matching task files', async () => {
    const cwd = repo({ [`${PLAN}/task-1-other.md`]: taskFile() })
    await refused(cwd, [], /task-1-demo\.md, task-1-other\.md/)
  })

  // Protects: a plan folder that does not exist or is empty fails with a message.
  test('missing and empty plan folders', async () => {
    const cwd = repo({ 'docs/empty/README.md': 'x\n' })
    const missing = await run(cwd, 'docs/nope', '1', '--no-ping')
    expect(missing.code).toBe(1)
    expect(missing.out).toContain('cannot find the plan folder')
    const empty = await run(cwd, 'docs/empty', '1', '--no-ping')
    expect(empty.code).toBe(1)
    expect(empty.out).toContain('no task file')
    noStack(missing.out + empty.out)
  })

  // Protects: several checkpoints and none named is an error listing them (the model gets one per run).
  test('several checkpoints and none given', async () => {
    const cwd = repo({ [`${PLAN}/task-1-demo.md`]: taskFile('local', BLOCK, ['1A', '1B']) })
    await refused(cwd, [], /several checkpoints \(1A, 1B\)/)
  })

  // Protects: a checkpoint that is not in the file is an error listing the real ones.
  test('unknown checkpoint', async () => {
    await refused(repo(), ['1Z'], /no checkpoint "1Z" \(it has: 1A\)/)
  })

  // Protects: a strong task is never handed to the local model.
  test('strong-tier task refused', async () => {
    const cwd = repo({ [`${PLAN}/task-1-demo.md`]: taskFile('strong', '') })
    await refused(cwd, [], /this task is not for the local model/)
  })

  // Protects: every missing part of the block is printed, and a malformed task file (no tier) is refused too.
  test('incomplete local block listed, malformed task refused', async () => {
    const half = '## Sized for the local model\n**May touch:** `a`\n'
    const cwd = repo({ [`${PLAN}/task-1-demo.md`]: taskFile('local', half) })
    const output = await refused(cwd, [], /"Must not change" is missing/)
    expect(output).toMatch(/"Stop and report" is missing.*\n.*"Model server" is missing.*\n.*"Checkpoint given" is missing/)
    await refused(repo({ [`${PLAN}/task-1-demo.md`]: '## Checkpoint 1A: x\nnothing\n' }), [], /Model tier/)
  })

  // Protects: an uncommitted change to a tracked file is refused and named, because the sandbox is built from HEAD.
  test('dirty tracked file refused, untracked only warned about', async () => {
    const cwd = repo()
    writeIn(cwd, 'untracked.txt', 'u')
    const warned = await go(cwd)
    expect(warned.code).toBe(0)
    expect(warned.out).toContain('warning: untracked files are not in the sandbox: untracked.txt')
    writeIn(cwd, '.pi/skills/local-task/SKILL.md', 'edited\n')
    await refused(cwd, [], /uncommitted changes to tracked files.*\.pi\/skills\/local-task\/SKILL\.md/)
  })

  // Protects: a task file that is not committed is refused, since HEAD (and so the sandbox) would not have it.
  test('uncommitted task file refused', async () => {
    const cwd = repo()
    writeIn(cwd, `${PLAN}/task-2-new.md`, taskFile())
    const result = await go(cwd, [], '2')
    expect(result.code).toBe(1)
    expect(result.out).toContain('is not committed')
  })

  // Protects: an existing sandbox path is never reused or removed.
  test('sandbox path already exists', async () => {
    const cwd = repo()
    const out = outPath()
    const first = await go(cwd, [], '1', out)
    expect(first.code).toBe(0)
    const second = await go(cwd, [], '1', out)
    expect(second.code).toBe(1)
    expect(second.out).toContain('already exists')
    expect(existsSync(join(out, '.git'))).toBe(true)
  })

  // Protects: a sandbox inside the working checkout is refused, so the checkout is never polluted.
  test('--out inside the checkout refused', async () => {
    const cwd = repo()
    const result = await go(cwd, [], '1', join(cwd, 'inner'))
    expect(result.code).toBe(1)
    expect(result.out).toContain('inside the working checkout')
    expect(existsSync(join(cwd, 'inner'))).toBe(false)
  })
})

describe('prepare-local-run: never removes what it did not create', () => {
  // Protects: a dangling symlink at --out (or at <out>-run) is refused and survives; it is not "a directory this run created".
  test.each(['', '-run'])('a dangling symlink at --out%s is refused and kept', async (suffix) => {
    const cwd = repo()
    const out = outPath()
    symlinkSync(join(out, '..', 'nowhere'), `${out}${suffix}`)
    const result = await go(cwd, [], '1', out)
    expect(result.code).toBe(1)
    expect(result.out).toContain('already exists')
    expect(lstatSync(`${out}${suffix}`).isSymbolicLink()).toBe(true)
  })

  // Protects: --out reached through a symlink that points into the checkout is refused, and nothing is created there.
  test('--out through a symlink into the checkout is refused', async () => {
    const cwd = repo()
    const parent = mkdtempSync(join(tmpdir(), 'link parent-'))
    cleanup.push(parent)
    symlinkSync(cwd, join(parent, 'link'))
    const result = await go(cwd, [], '1', join(parent, 'link', 'inner'))
    expect(result.code).toBe(1)
    expect(result.out).toContain('inside the working checkout')
    expect(existsSync(join(cwd, 'inner'))).toBe(false)
  })

  const base = { ping: async () => ({ ok: true, loaded: true, detail: '' }), runCheck: () => ({ ok: true, output: '' }), now: () => 0 }

  // Protects: a build failure after this run made the directory removes that directory only, and the node_modules it links to survives.
  test('a failure after our own mkdir cleans up only our directory', async () => {
    const cwd = repo()
    const out = outPath()
    const create = (root: string, sandbox: string): string => {
      mkdirSync(sandbox)
      symlinkSync(join(root, 'node_modules'), join(sandbox, 'node_modules'))
      throw new SandboxError('boom', true)
    }
    const outcome = await runPrepare(['--cwd', cwd, PLAN, '1', '--out', out], { ...base, create })
    expect(outcome.code).toBe(1)
    expect(existsSync(out)).toBe(false)
    expect(existsSync(join(cwd, 'node_modules', '.keep'))).toBe(true)
  })

  // Protects: when the directory appeared by someone else's hand (our mkdir failed), it is left alone.
  test('a directory we did not create is not removed', async () => {
    const cwd = repo()
    const out = outPath()
    const create = (_root: string, sandbox: string): string => {
      mkdirSync(sandbox)
      writeIn(sandbox, 'theirs.txt', 'keep')
      throw new SandboxError('cannot create', false)
    }
    const outcome = await runPrepare(['--cwd', cwd, PLAN, '1', '--out', out], { ...base, create })
    expect(outcome.code).toBe(1)
    expect(readFileSync(join(out, 'theirs.txt'), 'utf8')).toBe('keep')
  })

  // Protects: an unexpected throw anywhere (here the baseline runner, and the ping) gives a fixed message and exit 1, never a stack.
  test('an unexpected error prints no stack', async () => {
    const cwd = repo()
    const out = outPath()
    const baseline = await runPrepare(['--cwd', cwd, PLAN, '1', '--out', out], { ...base, runCheck: () => { throw new Error('secret http://u:p@h detail') } })
    expect(baseline.code).toBe(1)
    expect(baseline.lines.join('\n')).toContain('could not confirm the baseline')
    expect(baseline.lines.join('\n')).toContain(out)
    expect(baseline.lines.join('\n')).not.toMatch(/secret|u:p@/)
    const pinged = await runPrepare(['--cwd', cwd, PLAN, '1'], { ...base, ping: async () => { throw new Error('secret http://u:p@h detail') } })
    expect(pinged.code).toBe(1)
    expect(pinged.lines.join('\n')).toContain('unexpected error')
    expect(pinged.lines.join('\n')).not.toMatch(/secret|u:p@/)
  })
})

describe('prepare-local-run: arguments', () => {
  // Protects: usage errors exit 2 with a usage line, never a stack.
  test.each([[[]], [['p']], [['p', 'x']], [['p', '1', '--bogus']], [['p', '1', '--out']]])('usage error %j exits 2', async (args) => {
    const result = await run(repo(), ...args)
    expect(result.code).toBe(2)
    expect(result.out).toContain('usage: node scripts/prepare-local-run.ts')
    noStack(result.out)
  })

  // Protects: a model URL with a password is refused (exit 2) and the password is never printed.
  test('a model url with credentials is refused without echoing it', async () => {
    const result = await run(repo(), PLAN, '1', '--model-url', 'http://bob:hunter2@localhost:1')
    expect(result.code).toBe(2)
    expect(result.out).not.toMatch(/hunter2|bob/)
    expect(result.out).toContain('user name or password')
  })
})

describe('prepare-local-run: the model server', () => {
  let server: Server | undefined
  afterEach(() => { server?.close(); server = undefined })
  const serve = (body: string): Promise<string> => new Promise((resolve) => {
    server = createServer((_request, response) => { response.end(body) }).listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server?.address() as AddressInfo).port}`))
  })

  // Protects: a server that does not answer stops the run before anything is created.
  test('not answering stops before anything is created', async () => {
    const cwd = repo()
    const out = outPath()
    const result = await run(cwd, PLAN, '1', '--out', out, '--model-url', 'http://127.0.0.1:1')
    expect(result.code).toBe(1)
    expect(result.out).toContain('model server: NOT answering')
    expect(existsSync(out)).toBe(false)
    expect(existsSync(`${out}-run`)).toBe(false)
    noStack(result.out)
  })

  // Protects: an idle model is a warning, not a stop; a loaded one carries on silently; --no-ping says it was skipped.
  test('idle warns, loaded goes on, --no-ping says skipped', async () => {
    const cwd = repo()
    const idle = await run(cwd, PLAN, '1', '--out', outPath(), '--model-url', await serve('{"running":[]}'))
    expect(idle.code).toBe(0)
    expect(idle.out).toContain('model idle')
    expect(idle.out).toContain('first request will be slow')
    server?.close()
    const loaded = await run(cwd, PLAN, '1', '--out', outPath(), '--model-url', await serve('{"running":[{"model":"coder","state":"ready"}]}'))
    expect(loaded.code).toBe(0)
    expect(loaded.out).toContain('model server: answering, model loaded')
    const skipped = await go(cwd)
    expect(skipped.out).toContain('ping skipped')
  })
})

describe('prepare-local-run: success', () => {
  // Protects: a good run builds a remote-less sandbox with a linked node_modules, writes the prompt outside its git tree,
  // starts with the skill line, never names the probe folder, and prints the command with the baseline sha without running it.
  test('builds the sandbox, the prompt and the command', async () => {
    const cwd = repo()
    const out = outPath()
    const result = await go(cwd, [], '1', out)
    expect(result.code).toBe(0)
    const sha = git(out, 'rev-parse', 'HEAD')
    expect(git(out, 'remote')).toBe('')
    expect(git(out, 'status', '--porcelain')).toBe('')
    expect(lstatSync(join(out, 'node_modules')).isSymbolicLink()).toBe(true)
    expect(git(out, 'config', '--local', 'user.name')).not.toBe('')
    const promptFile = join(`${out}-run`, 'PROMPT.md')
    expect(existsSync(promptFile)).toBe(true)
    expect(existsSync(join(`${out}-run`, 'session'))).toBe(true)
    expect(readdirSync(out)).not.toContain('PROMPT.md')
    const prompt = readFileSync(promptFile, 'utf8')
    expect(prompt.startsWith('First, use the local-task skill.\n')).toBe(true)
    expect(prompt).toContain(`--task ${PLAN}/task-1-demo.md --base ${sha}`)
    expect(prompt).toContain(`You may touch ${'only'}: \`scripts/a.ts\`, \`scripts/a.test.ts\` (exhaustive)`)
    expect(prompt).not.toContain('tests/probes/demo')
    expect(result.out).toContain(`baseline sha: ${sha}`)
    expect(result.out).toContain('--skill .pi/skills/local-task')
    expect(result.out).toContain(`cd '${out}' && little-coder -p --session-dir '${out}-run/session'`)
    expect(result.out).toContain(`rm -rf '${out}' '${out}-run'`)
    expect(result.out).toContain('baseline: npm run lint and npm run typecheck are clean')
  })

  // Protects: the checkpoint is picked from a task with several when named, and a local checkpoint of a mid task is accepted.
  test('a named checkpoint, and a local checkpoint inside a mid task', async () => {
    const mid = `# T\n**Model tier:** mid\n**Checkpoint 1B tier:** local\n**Interfaces:** none\n${BLOCK.replace('1A', '1B')}\n## Checkpoint 1A: a\n## Checkpoint 1B: b\n${TEST_PLAN}\n`
    const cwd = repo({ [`${PLAN}/task-1-demo.md`]: mid })
    expect((await go(cwd, ['1B'])).code).toBe(0)
    const refused = await go(cwd, ['1A'])
    expect(refused.code).toBe(1)
    expect(refused.out).toContain('not for the local model')
  })

  // Protects: a lint that fails in the sandbox stops the run, prints the sandbox path and leaves it in place, and no prompt is written.
  test('a failing baseline stops and leaves the sandbox', async () => {
    const cwd = repo({}, 'node -e "console.log(\'lint is broken\');process.exit(3)"')
    const out = outPath()
    const result = await go(cwd, [], '1', out)
    expect(result.code).toBe(1)
    expect(result.out).toContain('npm run lint failed in the sandbox')
    expect(result.out).toContain('lint is broken')
    expect(result.out).toContain(out)
    expect(existsSync(join(out, '.git'))).toBe(true)
    expect(existsSync(`${out}-run`)).toBe(false)
    expect(result.out).not.toContain('little-coder')
  })
})

describe('runPrepare with injected effects', () => {
  // Protects: the baseline checks run through the injected runner in the sandbox, and a failure there is reported, not swallowed.
  test('a fake failing check is reported and the sandbox kept', async () => {
    const cwd = repo()
    const out = outPath()
    const seen: string[] = []
    const outcome = await runPrepare(['--cwd', cwd, PLAN, '1', '--out', out], {
      ping: async () => ({ ok: true, loaded: true, detail: 'model loaded' }),
      runCheck: (name, dir) => { seen.push(`${name}@${dir}`); return { ok: name !== 'typecheck', output: 'type error\n' } },
      now: () => 0,
    })
    expect(seen).toEqual([`lint@${out}`, `typecheck@${out}`])
    expect(outcome.code).toBe(1)
    expect(outcome.lines.join('\n')).toContain('npm run typecheck failed')
    expect(existsSync(join(out, '.git'))).toBe(true)
  })
})
