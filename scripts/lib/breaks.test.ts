import { describe, expect, test } from 'vitest'
import { applyBreak, type BreakDeps, runBreaks } from './breaks.ts'
import type { BreakRow } from './test-plan.ts'

// An in-memory BreakDeps. `passes` decides whether the named tests pass, given the files as they are
// at the moment the tests run; every write and every test run is recorded.
interface Fake extends BreakDeps { files: Map<string, string>; writes: string[]; runs: string[][] }
function fake(files: Record<string, string>, passes: (files: Map<string, string>, tests: string[]) => boolean): Fake {
  const state = new Map(Object.entries(files))
  const writes: string[] = []
  const runs: string[][] = []
  return {
    files: state,
    writes,
    runs,
    read(path) {
      const content = state.get(path)
      if (content === undefined) throw new Error(`ENOENT: ${path}`)
      return content
    },
    write(path, content) {
      writes.push(path)
      state.set(path, content)
    },
    async runTests(tests) {
      runs.push(tests)
      return passes(state, tests)
    },
  }
}

const SOURCE = 'export const isAdult = (age: number) => age >= 18\n'
const row = (id: string, find: string, replace: string, file = 'src/a.ts', tests = ['src/a.test.ts']): BreakRow => ({ id, file, find, replace, tests })
// The tests "catch" any change: they pass only while src/a.ts holds the original source.
const strictTests = (files: Map<string, string>) => files.get('src/a.ts') === SOURCE
const blindTests = () => true

describe('applyBreak', () => {
  // Protects the core of a break: a Find that occurs once is replaced, and only there.
  test('applyBreak replaces a single occurrence', () => {
    expect(applyBreak('a >= 18; b', '>=', '>')).toBe('a > 18; b')
  })

  // Protects Review Focus 2: a Find that is missing or ambiguous never edits the file.
  test('applyBreak returns null for zero and for two occurrences', () => {
    expect(applyBreak('a >= 18', '<=', '<')).toBeNull()
    expect(applyBreak('a >= 18 && b >= 3', '>=', '>')).toBeNull()
    expect(applyBreak('aaa', 'aa', 'b')).toBeNull() // overlapping matches are ambiguous too
    expect(applyBreak('abc', '', 'x')).toBeNull()
  })

  // Protects against applying a break to the wrong place: regex metacharacters are plain text.
  test('applyBreak treats find as literal text, not a regular expression ($, ., ( are literal)', () => {
    expect(applyBreak('fooXbar foo.bar', 'foo.bar', 'z')).toBe('fooXbar z')
    expect(applyBreak('cost$ = f(x)', 'f(x)', 'g(x)')).toBe('cost$ = g(x)')
    expect(applyBreak('a$ b', '$', '#')).toBe('a# b')
    expect(applyBreak('ab', '.', 'x')).toBeNull()
  })

  // Protects the Replace text: String.replace patterns ($&, $1, $$) are not expanded.
  test('a replace containing $& is inserted literally', () => {
    expect(applyBreak('x = 1', '1', '$&$&')).toBe('x = $&$&')
    expect(applyBreak('x = 1', '1', '$$ $1 $`')).toBe('x = $$ $1 $`')
  })
})

describe('runBreaks', () => {
  // Protects design 6.3: a break may touch only code Vitest reaches; nothing is written otherwise.
  test('runBreaks marks a break on a non-breakable path (tests/x.ts, a hook such as backend/pb_hooks/users-signup.pb.js, ../x.ts) invalid and writes nothing', async () => {
    const paths = ['tests/x.ts', 'backend/pb_hooks/users-signup.pb.js', '../x.ts', 'src/a.test.ts', '/etc/passwd']
    const deps = fake(Object.fromEntries(paths.map((path) => [path, SOURCE])), blindTests)
    const { results } = await runBreaks(paths.map((path, index) => row(`B${index}`, '>=', '>', path)), deps)
    expect(results.map((result) => result.status)).toEqual(paths.map(() => 'invalid'))
    expect(deps.writes).toEqual([])
  })

  // Protects: a break proves nothing against red tests, so none is applied.
  test('a failing baseline applies no break and writes nothing', async () => {
    const deps = fake({ 'src/a.ts': SOURCE }, () => false)
    const outcome = await runBreaks([row('B1', '>=', '>')], deps)
    expect(outcome).toEqual({ baselinePassed: false, results: [] })
    expect(deps.writes).toEqual([])
    expect(deps.runs).toHaveLength(1)
  })

  // Protects the restore guarantee on the normal path.
  test('a caught break restores the file', async () => {
    const deps = fake({ 'src/a.ts': SOURCE }, strictTests)
    const { baselinePassed, results } = await runBreaks([row('B1', '>=', '>')], deps)
    expect(baselinePassed).toBe(true)
    expect(results).toEqual([{ id: 'B1', status: 'caught', detail: '' }])
    expect(deps.files.get('src/a.ts')).toBe(SOURCE)
  })

  // Protects the point of the runner: tests that miss a break are reported, with the change named.
  test('a surviving break is reported and the file is restored', async () => {
    const deps = fake({ 'src/a.ts': SOURCE }, blindTests)
    const { results } = await runBreaks([row('B1', '>=', '>')], deps)
    expect(results).toEqual([{ id: 'B1', status: 'survived', detail: 'the tests did not notice src/a.ts: >= -> >' }])
    expect(deps.files.get('src/a.ts')).toBe(SOURCE)
  })

  // Protects Review Focus 2: a crash in the test run never leaves the broken file behind.
  test('runTests throwing still restores the file and rethrows', async () => {
    let calls = 0
    const deps = fake({ 'src/a.ts': SOURCE }, () => {
      calls++
      if (calls === 2) throw new Error('vitest crashed')
      return true
    })
    await expect(runBreaks([row('B1', '>=', '>')], deps)).rejects.toThrow('vitest crashed')
    expect(deps.files.get('src/a.ts')).toBe(SOURCE)
    expect(deps.writes).toEqual(['src/a.ts', 'src/a.ts'])
  })

  // Protects Review Focus 2: an ambiguous or missing Find, an unreadable file or no tests is invalid, never applied.
  test('an invalid break (find twice) writes nothing', async () => {
    const deps = fake({ 'src/a.ts': 'a >= 1 && b >= 2\n' }, blindTests)
    const breaks = [row('B1', '>=', '>'), row('B2', '<', '<='), row('B3', 'a', 'b', 'src/missing.ts'), row('B4', '&&', '||', 'src/a.ts', [])]
    const { results } = await runBreaks(breaks, deps)
    expect(results.map((result) => result.status)).toEqual(['invalid', 'invalid', 'invalid', 'invalid'])
    expect(results[0].detail).toMatch(/2 times/)
    expect(results[1].detail).toMatch(/0 times/)
    expect(results[2].detail).toMatch(/cannot read src\/missing\.ts/)
    expect(results[3].detail).toMatch(/no tests/)
    expect(deps.writes).toEqual([])
  })

  // Protects: a break is judged by the tests the plan names for it, and the baseline runs the union once.
  test('each break runs only its own named tests', async () => {
    const deps = fake({ 'src/a.ts': SOURCE, 'src/b.ts': 'x < 1\n' }, blindTests)
    await runBreaks([row('B1', '>=', '>', 'src/a.ts', ['src/a.test.ts']), row('B2', '<', '<=', 'src/b.ts', ['src/b.test.ts', 'src/a.test.ts'])], deps)
    expect(deps.runs).toEqual([['src/a.test.ts', 'src/b.test.ts'], ['src/a.test.ts'], ['src/b.test.ts', 'src/a.test.ts']])
  })

  // Protects Review Focus 2: the restore writes back exactly what was read, line endings and all.
  test('the restored content is byte-identical (including CRLF and no trailing newline)', async () => {
    const original = 'line one\r\nif (age >= 18) {\r\n  return true\r\n}'
    const deps = fake({ 'src/a.ts': original }, (files) => files.get('src/a.ts') === original)
    const { results } = await runBreaks([row('B1', '>=', '>')], deps)
    expect(results[0].status).toBe('caught')
    expect(deps.files.get('src/a.ts')).toBe(original)
  })

  // Protects: every break starts from the original file, so one break never hides inside another.
  test('two breaks on the same file do not compound (the second starts from the original)', async () => {
    const seen: string[] = []
    const deps = fake({ 'src/a.ts': 'a >= 18 && b < 3\n' }, (files) => {
      seen.push(files.get('src/a.ts') ?? '')
      return true
    })
    await runBreaks([row('B1', '>=', '>'), row('B2', '<', '<=')], deps)
    expect(seen).toEqual(['a >= 18 && b < 3\n', 'a > 18 && b < 3\n', 'a >= 18 && b <= 3\n'])
    expect(deps.files.get('src/a.ts')).toBe('a >= 18 && b < 3\n')
  })

  // Protects: an empty break list runs nothing (an empty test list would make Vitest run every test).
  test('an empty break list runs no tests and reports no results', async () => {
    const deps = fake({}, blindTests)
    expect(await runBreaks([], deps)).toEqual({ baselinePassed: true, results: [] })
    expect(deps.runs).toEqual([])
  })
})
