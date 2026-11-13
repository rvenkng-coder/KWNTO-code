import { describe, expect, test } from 'vitest'
import { parseTestFile } from './test-ast.ts'

const lines = (...rows: string[]): string => rows.join('\n') + '\n'
const q = '`'
// Words are assembled so this file does not trip its own hygiene rules.
const w = (...parts: string[]): string => parts.join('')
const found = (path: string, source: string): { line: number; title: string | null }[] =>
  parseTestFile(path, source).declarations.map(({ line, title }) => ({ line, title }))

describe('what counts as a declaration', () => {
  // Protects Review Focus 1: declarations are found in any expression position, in templates and in JSX.
  test('conditional, export default, comma, parenthesised, template and JSX positions are found', () => {
    const source = lines(
      "cond ? test('a', () => {}) : null;",
      "export default test('b', () => {});",
      "x, it('c', () => {});",
      "(test('d', () => {}));",
      `const t = ${q}\${` + w('te', "st('e', () => {})}") + q,
      w('const el = <div onClick={() => i', "t('f', () => {})} />"),
    )
    expect(found('a.test.tsx', source).map((d) => d.title)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  // Protects Review Focus 1: strings, comments, regex literals and JSX text are not code.
  test('strings, comments, regex literals and JSX text hold no declarations', () => {
    const source = lines(
      "const s = \"test('a', () => {})\"", "// test('b', () => {})", "/* it('c', () => {}) */",
      "const r = /test('d')/", "const el = <p>it('e', () => {})</p>", "const t = `test('f')`",
    )
    expect(found('a.test.tsx', source)).toEqual([])
  })

  // Protects Review Focus 1: modifier chains count once; describe is not a test.
  test('each, runIf, skip and tagged-template chains count once and describe does not count', () => {
    const source = lines(
      "test.each([1, 2])('a %s', () => {})", w('it.run', "If(ok)('b', () => {})"), w('test.concurrent.sk', "ip('c', () => {})"),
      `it.each${q}x${q}('d', () => {})`, "describe('e', () => {})",
    )
    expect(found('a.test.ts', source).map((d) => d.title)).toEqual(['a %s', 'b', 'c', 'd'])
  })

  // Protects Review Focus 1: a comment marker inside a template literal or a regex class cannot hide later tests.
  test('template literals with /* and regex classes with / do not hide later tests', () => {
    const source = lines(`const t = ${q}src/*.ts${q}`, `const isQ = (s: string) => /[/${q}]/.test(s)`, "test('a', () => {})", '/* end */')
    expect(found('a.test.ts', source)).toEqual([{ line: 3, title: 'a' }])
  })
})

describe('titles and expects', () => {
  // Protects the lost-test rule: literal titles are read, anything else is unreadable (null) but still counted.
  test('string, template and unreadable titles', () => {
    const source = lines(
      "test('plain', () => {})", `test(${q}tpl${q}, () => {})`, `test(${q}a \${n} b${q}, () => {})`, 'test(name, () => {})', 'test()',
    )
    expect(found('a.test.ts', source).map((d) => d.title)).toEqual(['plain', 'tpl', 'a ${} b', null, null])
  })

  // Protects the lost-assertion rule: only real expect calls count, once each.
  test('expect, expect.soft and expect.poll count once and strings and comments do not', () => {
    const source = lines('expect(a).toBe(1)', 'expect.soft(b).toBe(2)', 'expect.poll(c).toBe(3)', "const s = 'expect('", '// expect(z)')
    expect(parseTestFile('a.test.ts', source).expects).toBe(3)
  })

  // Protects fail-closed behaviour: a syntax error is reported, with its line.
  test('a syntax error sets ok to false and names the line', () => {
    const parsed = parseTestFile('a.test.ts', lines('const a = 1', 'const broken = ('))
    expect(parsed.ok).toBe(false)
    expect(parsed.error).toMatch(/line \d+/)
    expect(parseTestFile('a.test.ts', lines('const a = 1')).ok).toBe(true)
  })
})

describe('speed', () => {
  // Protects the command's usability: a large file is parsed and walked in well under a second.
  test('5,000 generated tests are parsed in under a second', () => {
    const source = Array.from({ length: 5000 }, (_, n) => `// Protects: r\ntest('t${n}', () => { expect(${n}).toBe(${n}) })`).join('\n')
    const started = Date.now()
    const parsed = parseTestFile('a.test.ts', source)
    expect(parsed.declarations).toHaveLength(5000)
    expect(parsed.declarations[4999]).toMatchObject({ line: 10000, title: 't4999' })
    expect(parsed.expects).toBe(5000)
    expect(Date.now() - started).toBeLessThan(1000)
  })
})
