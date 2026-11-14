// Protects prepare-local-run's pure rules: which arguments are accepted, which task file and checkpoint are
// picked, when a checkpoint is refused for the local model, and what the prompt and the printed block say.
import { describe, expect, test } from 'vitest'
import {
  buildPrompt, checkpointTier, defaultSandboxName, listCheckpoints, localRunProblems, parseArgs, readLocalBlock,
  readyBlock, selectCheckpoint, selectTaskFile, shellQuote,
} from './local-run.ts'

const BLOCK = [
  '## Sized for the local model',
  '**May touch:** `scripts/a.ts`, `scripts/a.test.ts` (exhaustive)',
  '**Must not change:** the signature of `a`',
  'Stop and report if you need to touch anything else.',
  '**Model server:** run `npm run ping:model` first',
  '**Checkpoint given:** Checkpoint 1A only',
].join('\n')
const PLAN = [
  '## Test plan', '### Cases', '| ID | Behaviour | Layer | Input | Expected | Test |', '|---|---|---|---|---|---|',
  '| C1 | b | unit | `a()` | `1` | scripts/a.test.ts :: b |', '### Probes', '**Probe folder:** `tests/probes/p/1/`',
  '### Breaks', '| ID | File | Find | Replace | Tests |', '|---|---|---|---|---|', '| B1 | scripts/a.ts | `a < b` | `a <= b` | scripts/a.test.ts |',
  '### Flow', 'none', '### Evidence', 'the output',
].join('\n')
const task = (tier: string, extra = '', block = BLOCK): string =>
  `# Task 1\n**Model tier:** ${tier}\n${extra}**Interfaces:** none\n${block}\n## Checkpoint 1A: first\n- [ ] step\n${PLAN}\n`

describe('parseArgs', () => {
  // Protects: a plain call is read into plan folder, task number, no checkpoint, the default server.
  test('two positionals and defaults', () => {
    expect(parseArgs(['docs/p', '3'], '/w')).toEqual({ planDir: 'docs/p', task: 3, checkpoint: null, modelUrl: 'http://localhost:9092', out: null, noPing: false, cwd: '/w' })
  })

  // Protects: every option and the optional checkpoint are read.
  test('a checkpoint and all options', () => {
    expect(parseArgs(['p', '12', '12B', '--out', 'o', '--no-ping', '--model-url', 'http://h:1', '--cwd', 'c'], '/w'))
      .toMatchObject({ task: 12, checkpoint: '12B', out: 'o', noPing: true, modelUrl: 'http://h:1', cwd: 'c' })
  })

  // Protects: bad arguments are errors, not guesses: wrong count, a non-number task, an unknown option, a missing value, a duplicate.
  test.each([
    [[]], [['p']], [['p', '1', 'A', 'B']], [['p', 'x']], [['p', '0']], [['p', '1.5']], [['p', '1', '../x']],
    [['p', '1', '--bogus']], [['p', '1', '--out']], [['p', '1', '--out', '--no-ping']], [['p', '1', '--no-ping', '--no-ping']],
    [['p', '1', '--out', 'a', '--out', 'b']], [['p', '1', '--model-url', 'ftp://h']],
  ])('%j is an error', (argv) => {
    expect(parseArgs(argv)).toHaveProperty('error')
  })

  // Protects: a model URL with a password is refused and the error never repeats it.
  test('a url with credentials is refused without echoing it', () => {
    const result = parseArgs(['p', '1', '--model-url', 'http://bob:hunter2@h:1'])
    expect(JSON.stringify(result)).not.toMatch(/hunter2|bob/)
    expect(result).toHaveProperty('error')
  })

  // Protects: an option written with = (which could carry a password) is an unknown option, never echoed.
  test('--model-url=... is an unknown option and is not echoed', () => {
    const result = parseArgs(['p', '1', '--model-url=http://bob:hunter2@h'])
    expect(result).toEqual({ error: 'unknown option' })
  })
})

describe('selectTaskFile', () => {
  // Protects: task 1 is not confused with task 10, and exactly one match is returned.
  test('matches task-N- exactly', () => {
    expect(selectTaskFile(['task-1-a.md', 'task-10-b.md'], 1)).toEqual({ file: 'task-1-a.md' })
  })

  // Protects: no match is an error that lists what the folder has.
  test('no match lists the files', () => {
    expect(selectTaskFile(['task-2-a.md'], 1)).toEqual({ error: expect.stringContaining('task-2-a.md') })
    expect(selectTaskFile([], 1)).toEqual({ error: expect.stringContaining('none') })
  })

  // Protects: two matches are an error that names both, never the first one.
  test('several matches name them', () => {
    expect(selectTaskFile(['task-1-b.md', 'task-1-a.md'], 1)).toEqual({ error: expect.stringContaining('task-1-a.md, task-1-b.md') })
  })
})

describe('checkpoints', () => {
  // Protects: checkpoint ids are read from headings, not from examples in code fences or comments.
  test('listCheckpoints skips fences and comments', () => {
    const text = '## Checkpoint 1A: x\n```\n## Checkpoint 9Z: example\n```\n<!-- ## Checkpoint 8Y: note -->\n## Checkpoint 1B: y\n'
    expect(listCheckpoints(text)).toEqual(['1A', '1B'])
  })

  // Protects: one checkpoint per run: the only one is taken, several need a choice, an unknown one lists the real ones.
  test('selectCheckpoint', () => {
    expect(selectCheckpoint(['1A'], null)).toEqual({ id: '1A' })
    expect(selectCheckpoint(['1A', '1B'], '1B')).toEqual({ id: '1B' })
    expect(selectCheckpoint(['1A', '1B'], null)).toEqual({ error: expect.stringContaining('1A, 1B') })
    expect(selectCheckpoint(['1A', '1B'], '1C')).toEqual({ error: expect.stringContaining('1A, 1B') })
    expect(selectCheckpoint([], null)).toHaveProperty('error')
    expect(selectCheckpoint(['1A', '1A'], '1A')).toHaveProperty('error')
  })

  // Protects: a checkpoint's own tier line wins over the task's tier, in both directions.
  test('checkpointTier', () => {
    expect(checkpointTier(task('mid', '**Checkpoint 1A tier:** local\n'), '1A')).toBe('local')
    expect(checkpointTier(task('local', '**Checkpoint 1A tier:** strong\n'), '1A')).toBe('strong')
    expect(checkpointTier(task('local'), '1A')).toBe('local')
    expect(checkpointTier(task('mid', '**Checkpoint 1A tier:** weird\n'), '1A')).toBeNull()
  })
})

describe('readLocalBlock and localRunProblems', () => {
  // Protects: the May touch and Must not change values are copied without their labels.
  test('reads the parts', () => {
    expect(readLocalBlock(task('local'))).toEqual({
      mayTouch: '`scripts/a.ts`, `scripts/a.test.ts` (exhaustive)', mustNotChange: 'the signature of `a`', checkpointGiven: 'Checkpoint 1A only',
    })
    expect(readLocalBlock(task('mid', '', ''))).toBeNull()
  })

  // Protects: a complete local checkpoint has no problems, so a run can go ahead.
  test('a good local task is clean', () => {
    expect(localRunProblems('t.md', task('local'), '1A')).toEqual([])
  })

  // Protects: a strong or mid task is refused with the plain sentence, even though check:plan alone would accept it.
  test.each(['strong', 'mid'])('a %s task is refused', (tier) => {
    expect(localRunProblems('t.md', task(tier, '', ''), '1A')[0]).toContain('this task is not for the local model')
  })

  // Protects: a checkpoint can be strong inside a local task, and is refused on its own.
  test('a strong checkpoint of a local task is refused', () => {
    expect(localRunProblems('t.md', task('local', '**Checkpoint 1A tier:** strong\n'), '1A')[0]).toContain('not for the local model')
  })

  // Protects: every missing part of the block is listed, not only the first.
  test('an incomplete block lists each missing part', () => {
    const problems = localRunProblems('t.md', task('local', '', '## Sized for the local model\n**May touch:**\n'), '1A')
    expect(problems.join('\n')).toMatch(/May touch.*Must not change.*Stop and report.*Model server.*Checkpoint given/s)
  })

  // Protects: the block must say this checkpoint is the one given; a block naming another checkpoint is a problem.
  test('Checkpoint given must name the chosen checkpoint', () => {
    const other = BLOCK.replace('Checkpoint 1A only', 'Checkpoint 1B only')
    expect(localRunProblems('t.md', task('local', '', other), '1A').join('\n')).toContain('does not name checkpoint 1A')
  })
})

describe('prompt and printed block', () => {
  const input = { sandbox: '/tmp/s x', checkpoint: '1A', taskFile: 'docs/p/task-1-a.md', mayTouch: 'M', mustNotChange: 'N', baseSha: 'abc123' }

  // Protects: the prompt starts with the skill line, carries the values and the exact check command, and never names a probe folder.
  test('buildPrompt', () => {
    const prompt = buildPrompt(input)
    expect(prompt.startsWith('First, use the local-task skill.\n')).toBe(true)
    expect(prompt).toContain('You are working in /tmp/s x.')
    expect(prompt).toContain('Do Checkpoint 1A of docs/p/task-1-a.md.')
    expect(prompt).toContain(`You may touch ${'only'}: M\nYou must not change: N`)
    expect(prompt).toContain('`npm run check:task -- --task docs/p/task-1-a.md --base abc123`')
    expect(prompt).toContain('Do not read anything under tests/probes/.')
    expect(prompt.match(/tests\/probes/g)).toHaveLength(1)
  })

  // Protects: a task file path with a space is quoted in the prompt's check command and in the after-run line.
  test('a task path with a space is quoted', () => {
    const spaced = { ...input, taskFile: 'docs/my plan/task-1-a.md' }
    expect(buildPrompt(spaced)).toContain("--task 'docs/my plan/task-1-a.md' --base abc123")
    expect(readyBlock('/s', '/s-run', 'abc123', spaced.taskFile).join('\n')).toContain("--task 'docs/my plan/task-1-a.md' --base")
  })

  // Protects: paths with spaces or quotes survive being pasted into a shell.
  test('shellQuote', () => {
    expect(shellQuote('/tmp/a-b_c.d')).toBe('/tmp/a-b_c.d')
    expect(shellQuote('/tmp/a b')).toBe("'/tmp/a b'")
    expect(shellQuote("/tmp/it's")).toBe("'/tmp/it'\\''s'")
  })

  // Protects: the default directory name carries plan, task, checkpoint and a timestamp, and nothing a path cannot hold.
  test('defaultSandboxName', () => {
    const name = defaultSandboxName('docs/plans/2026-11-14-core/', 3, '3A', Date.UTC(2026, 10, 14, 9, 8, 7))
    expect(name).toBe('kwnto-local-2026-11-14-core-task3-3A-20261114T090807Z')
    expect(defaultSandboxName('a b/c d', 1, 'x/y', 0)).toMatch(/^kwnto-local-c_d-task1-x_y-/)
  })

  // Protects: the final block names the sandbox, the sha, the prompt file and the start command, and both cleanup directories.
  test('readyBlock', () => {
    const text = readyBlock('/tmp/s x', '/tmp/s x-run', 'abc123', 'docs/p/task-1-a.md').join('\n')
    expect(text).toContain("cd '/tmp/s x' && little-coder -p --session-dir '/tmp/s x-run/session' --skill .pi/skills/local-task \"$(cat '/tmp/s x-run/PROMPT.md')\"")
    expect(text).toContain('baseline sha: abc123')
    expect(text).toContain('npm run check:task -- --task docs/p/task-1-a.md --base abc123')
    expect(text).toContain("rm -rf '/tmp/s x' '/tmp/s x-run'")
    expect(text).toContain('tests/probes/')
  })
})
