import { describe, expect, test } from 'vitest'
import { checkSource, compareWithBase } from './check-test-hygiene.ts'

const lines = (...rows: string[]): string => rows.join('\n') + '\n'
const rules = (problems: { rule: string }[]): string[] => problems.map((problem) => problem.rule)
const one = "test('one', () => { expect(1).toBe(1) })"
const two = "test('two', () => { expect(2).toBe(2) })"
const el = 'const el = <code>src/*.ts</code>'
const base = lines(el, '// P', one, '// P', two, '/* end */')

describe('the reviewer inputs: JSX text with /* after a word', () => {
  // Protects Review Focus 1: swapping a test for another is reported even when JSX text looks like a comment opener.
  test('swapping a test is reported', () => {
    const head = lines(el, '// P', one, '// P', "test('three', () => { expect(2).toBe(2) })", '/* end */')
    const problems = compareWithBase('a.test.tsx', base, head)
    expect(rules(problems)).toEqual(['lost-test'])
    expect(problems[0].detail).toMatch(/two/)
  })

  // Protects Review Focus 1: deleting a test and leaving a commented-out copy is a lost test and a lost assertion.
  test('deleting a test and leaving a commented-out copy is reported', () => {
    const head = lines(el, '// P', one, `// ${two}`, '/* end */')
    expect(rules(compareWithBase('a.test.tsx', base, head))).toEqual(
      expect.arrayContaining(['lost-test', 'lost-assertion']),
    )
  })

  // Protects Review Focus 1: a new header-less test is reported wherever it sits in an expression.
  test('a header-less new test is reported in a conditional, export default, comma and parenthesised form', () => {
    for (const code of [
      "cond ? test('new', () => {}) : null",
      "export default test('new', () => {})",
      "x, test('new', () => {})",
      "(test('new', () => {}))",
    ]) {
      const source = lines(el, '// P', one, code, '/* end */')
      expect(rules(checkSource('a.test.tsx', source, null)), code).toContain('header')
    }
  })
})

describe('other ways to fool a counter', () => {
  // Protects Review Focus 1: the deleted test's title appearing as a string elsewhere does not hide the removal.
  test('a deleted test whose title still appears as a string is reported', () => {
    const head = lines('// P', one, "const note = 'two'")
    const problems = compareWithBase('a.test.ts', lines('// P', one, '// P', two), head)
    expect(rules(problems)).toContain('lost-test')
    expect(problems.map((p) => p.detail).join('\n')).toMatch(/two/)
  })

  // Protects Review Focus 1: an expect( mention added in a string does not offset a real expect( that was removed.
  test('an expect( mention added in a string while a real expect is removed is reported', () => {
    const head = lines(one, "test('two', () => {})", "const s = 'expect('")
    expect(rules(compareWithBase('a.test.ts', lines(one, two), head))).toEqual(['lost-assertion'])
  })

  // Protects Review Focus 1: a regex ending in */ on the line above is not a comment, so it is not a header.
  test('a regex ending in */ above a test is not a header', () => {
    expect(rules(checkSource('a.test.ts', lines('const re = /a*/', "test('new', () => {})"), null))).toContain('header')
  })

  // Protects the header rule: two tests on one line cannot each have a comment, so it is a problem.
  test('two tests on one line fail header', () => {
    expect(
      rules(checkSource('a.test.ts', lines('// P', "test('a', () => {}); te" + "st('b', () => {})"), null)),
    ).toContain('header')
  })

  // Protects the header rule: a block comment or JSDoc directly above counts, one separated by a blank line does not.
  test('a JSDoc comment directly above is a header, one with a blank line between is not', () => {
    expect(checkSource('a.test.ts', lines('/** Protects: r', ' */', "test('a', () => {})"), null)).toEqual([])
    expect(rules(checkSource('a.test.ts', lines('/** Protects: r */', '', "test('a', () => {})"), null))).toEqual([
      'header',
    ])
  })
})

describe('the raw header backstop', () => {
  // Protects fail-closed behaviour: in a file with a syntax error the parser is not trusted, and the raw lines still catch a bare test.
  test('a header-less test in a file with a syntax error is reported with scan', () => {
    const problems = checkSource('a.test.ts', lines('const broken = (', "test('new', () => {})"), null)
    expect(rules(problems)).toEqual(expect.arrayContaining(['scan', 'header']))
  })
})
