import { describe, expect, test } from 'vitest'
import { checkSource, compareWithBase } from './check-test-hygiene.ts'

const lines = (...rows: string[]): string => rows.join('\n') + '\n'
const rules = (problems: { rule: string }[]): string[] => problems.map((problem) => problem.rule)
const one = "test('one', () => { expect(1).toBe(1) })"
const two = "test('two', () => { expect(2).toBe(2) })"
const q = '`'

// Inputs on which a naive scanner misreads a regex or JSX text as a comment or template literal.
const CONFUSING: [string, string, string, string][] = [
  ['.test.ts', 'a regex after => with /[/*]/', 'const isGlob = (s: string) => /[/*]/.test(s)', '/* end */'],
  ['.test.ts', 'a regex after return with /^\\/*/', 'function f(s: string) { return /^\\/*/.test(s) }', '/* end */'],
  ['.test.ts', 'a regex after => with a backtick class', `const q = (s: string) => /[${q}'"]/.test(s)`, `const z = ${q}end${q}`],
  ['.test.ts', 'a regex after ) with a backtick', `if (x) /${q}/.test(s)`, `const z = ${q}end${q}`],
  ['.test.tsx', 'JSX text with /*', 'const el = <code>src/*.ts</code>', '/* end */'],
  ['.test.tsx', 'JSX text with a backtick', `const el = <p>press ${q}</p>`, `const z = ${q}end${q}`],
]

describe('a scanner that is confused must not hide a removed test', () => {
  for (const [ext, name, prefix, suffix] of CONFUSING) {
    // Protects Review Focus 1: whatever the scanner misreads, a removed test and expect( are still reported (raw counts).
    test(`lost-test and lost-assertion survive ${name} (${ext})`, () => {
      const base = lines(prefix, one, two, suffix)
      const head = lines(prefix, one, suffix)
      expect(rules(compareWithBase(`a${ext}`, base, head))).toEqual(expect.arrayContaining(['lost-test', 'lost-assertion']))
    })
  }

  // Protects Review Focus 1: a new test without a header is still reported when the scanner is confused.
  test('a header-less new test is caught after a confusing regex', () => {
    const source = lines('const isGlob = (s: string) => /[/*]/.test(s)', "test('new', () => {})", '/* end */')
    expect(rules(checkSource('a.test.ts', source, null))).toContain('header')
  })
})

describe('unterminated constructs', () => {
  // Protects fail-closed behaviour: if the scan ends inside a comment or template literal the file is not read reliably.
  test('an unterminated block comment or template literal reports scan', () => {
    expect(rules(checkSource('a.test.ts', lines('// Protects: r', one, '/* never closed'), null))).toContain('scan')
    expect(rules(checkSource('a.test.ts', lines('// Protects: r', one, `const t = ${q}never closed`), null))).toContain('scan')
  })

  // Protects against false alarms: a lone apostrophe in JSX text must neither crash the scan nor count as unterminated.
  test('JSX apostrophe text is not reported as unterminated', () => {
    const source = lines("const el = <p>don't</p>", '// Protects: r', one)
    expect(checkSource('a.test.tsx', source, null)).toEqual([])
  })

  // Protects against false alarms: a well-formed file has no scan problem.
  test('a well-formed file has no scan problem', () => {
    expect(checkSource('a.test.ts', lines('/* ok */', `const t = ${q}x${q}`, '// Protects: r', one), null)).toEqual([])
  })
})
