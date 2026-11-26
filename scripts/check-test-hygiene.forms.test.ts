import { describe, expect, test } from 'vitest'
import { checkSource, compareWithBase } from './check-test-hygiene.ts'

// Token words are assembled so this file does not contain the literal words it detects.
const w = (...parts: string[]): string => parts.join('')
const lines = (...rows: string[]): string => rows.join('\n') + '\n'
const rules = (problems: { rule: string }[]): string[] => problems.map((problem) => problem.rule)
const one = "test('one', () => { expect(1).toBe(1) })"
const two = "test('two', () => { expect(2).toBe(2) })"

describe('lost-test with titles the scanner cannot read on the line', () => {
  // Protects: a title on the line after the call is still compared, so a swap cannot hide a removal.
  test('removing a test and adding another is caught when titles sit on the next line', () => {
    const base = lines(
      'test(',
      "  'one', () => { expect(1).toBe(1) })",
      'test(',
      "  'two', () => { expect(2).toBe(2) })",
    )
    const head = lines(
      'test(',
      "  'one', () => { expect(1).toBe(1) })",
      'test(',
      "  'three', () => { expect(2).toBe(2) })",
    )
    const problems = compareWithBase('a.test.ts', base, head)
    expect(rules(problems)).toEqual(['lost-test'])
    expect(problems[0].detail).toMatch(/two/)
  })

  // Protects: when titles are variables only the count can show a removal, so the count fallback must work alone.
  test('a count drop alone fails lost-test when no title is readable', () => {
    const base = lines('test(nameA, () => { expect(1).toBe(1) })', 'test(nameB, () => { expect(2).toBe(2) })')
    const head = lines('test(nameA, () => { expect(1).toBe(1); expect(2).toBe(2) })')
    const problems = compareWithBase('a.test.ts', base, head)
    expect(rules(problems)).toEqual(['lost-test'])
    expect(problems[0].detail).toMatch(/2 tests at base, 1 now/)
  })
})

describe('comment markers inside strings and regex literals', () => {
  // Protects: '/*' inside a string must not blank the tests that follow it.
  test('a glob string with /* does not hide a deleted test or expect(', () => {
    const base = lines("const g = 'src/*.ts'", one, two, "const h = ['**/node_modules']")
    const head = lines("const g = 'src/*.ts'", one, "const h = ['**/node_modules']")
    expect(rules(compareWithBase('a.test.ts', base, head)).sort()).toEqual(['lost-assertion', 'lost-test', 'lost-test'])
  })

  // Protects: '/*' inside a regex literal must not blank the tests that follow it.
  test('a regex literal with /* does not hide a deleted test or expect(', () => {
    const rx = String.raw`const r = /a\/*/`
    const base = lines(rx, one, two, '/* end */')
    const head = lines(rx, one, '/* end */')
    expect(rules(compareWithBase('a.test.ts', base, head)).sort()).toEqual(['lost-assertion', 'lost-test', 'lost-test'])
  })
})

describe('declaration forms', () => {
  // Protects: a test declared after other code on the line still needs a header.
  test('assigned, exported, awaited, returned and comment-prefixed declarations fail header', () => {
    for (const line of [
      w('const t = te', "st('a', () => {})"),
      w('export const y = i', "t.each([1])('a', () => {})"),
      w('await te', "st('a', () => {})"),
      w('return i', "t('a', () => {})"),
      w('/* c */ te', "st('a', () => {})"),
    ]) {
      expect(rules(checkSource('a.test.ts', lines('const x = 1', line), null)), line).toEqual(['header'])
    }
  })

  // Protects: removing a test declared in those forms is a lost-test.
  test('a removed assigned or exported declaration is a lost-test', () => {
    const base = lines(w('const t = te', "st('a', () => {})"), w('export const y = i', "t.each([1])('b', () => {})"))
    expect(rules(compareWithBase('a.test.ts', base, ''))).toContain('lost-test')
    expect(
      compareWithBase('a.test.ts', base, '')
        .map((p) => p.detail)
        .join('\n'),
    ).toMatch(/"a"[\s\S]*"b"/)
  })

  // Protects the header rule's scope: a commented-out test line is not a test and needs no header.
  test('a commented-out test line is not a declaration, but code after a block comment is', () => {
    const source = lines(
      "// test('a', () => {})",
      '/*',
      " * it('b')",
      ' */',
      "/* test('c') */",
      'const s = "it(\'d\')"',
    )
    expect(checkSource('a.test.ts', source, null)).toEqual([])
    expect(rules(checkSource('a.test.ts', lines("/* x */ it('e', () => {})"), null))).toEqual(['header'])
  })
})

describe('more ways to skip or focus', () => {
  // Protects: option-object, runIf, fixture-skip and fails forms all disable or invert a test.
  test('option objects, runIf, a skip call and fails fail skipped', () => {
    for (const line of [
      w("test('a', { sk", 'ip: true }, () => {})'),
      w("test('a', { to", 'do: true }, () => {})'),
      w('it.run', "If(false)('a', () => {})"),
      w('describe.run', "If(false)('a', () => {})"),
      w("test('a', ({ sk", 'ip }) => { sk', 'ip() })'),
      w('test.fa', "ils('a', () => {})"),
      w('test.fa', "il('a', () => {})"),
    ]) {
      expect(rules(checkSource('a.test.ts', lines('// Protects: r', line), new Set())), line).toEqual(['skipped'])
    }
  })

  // Protects: an option-object focus runs only some tests.
  test('an only option object fails focused', () => {
    expect(
      rules(checkSource('a.test.ts', lines('// Protects: r', w("test('a', { on", 'ly: true }, () => {})')), new Set())),
    ).toEqual(['focused'])
  })
})

describe('option values of any kind', () => {
  // Protects: the value does not matter, a skip, only, todo or fails option is a switch (variable, number,
  // negation, quoted key).
  test('skip, todo and fails options fail skipped whatever the value', () => {
    for (const line of [
      w("test('a', { sk", 'ip: isCI }, () => {})'),
      w("test('a', { sk", 'ip: 1 }, () => {})'),
      w("test('a', { 'sk", "ip': true }, () => {})"),
      w("test('a', { \"sk", 'ip": true }, () => {})'),
      w("test('a', { to", 'do: cond }, () => {})'),
      w("test('a', { fa", 'ils: true }, () => {})'),
    ]) {
      expect(rules(checkSource('a.test.ts', lines('// Protects: r', line), new Set())), line).toEqual(['skipped'])
    }
  })

  // Protects: a focus option with any value runs only some tests.
  test('only options fail focused whatever the value', () => {
    for (const line of [
      w("test('a', { on", 'ly: !0 }, () => {})'),
      w("test('a', { 'on", "ly': true }, () => {})"),
      w("test('a', { on", 'ly: flag }, () => {})'),
    ]) {
      expect(rules(checkSource('a.test.ts', lines('// Protects: r', line), new Set())), line).toEqual(['focused'])
    }
  })
})
