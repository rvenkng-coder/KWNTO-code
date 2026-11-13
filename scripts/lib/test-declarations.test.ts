import { describe, expect, test } from 'vitest'
import { findDeclarations, maskNonCode, scanSource } from './test-declarations.ts'

const q = '`'
const lines = (...rows: string[]): string => rows.join('\n') + '\n'

describe('scanner details', () => {
  // Protects Review Focus 1: a comment marker inside a template literal must not hide the tests after it.
  test('a template literal containing /* does not open a comment', () => {
    const source = lines(`const t = ${q}src/*.ts${q}`, "test('a', () => {})", '/* end */')
    expect(findDeclarations(source)).toEqual([{ line: 2, title: 'a' }])
  })

  // Protects Review Focus 1: a slash inside a regex character class does not end the regex, so a later backtick is not misread.
  test('a slash inside a regex character class does not end the regex', () => {
    const source = lines(`const isQ = (s: string) => /[/${q}]/.test(s)`, "test('a', () => {})")
    expect(findDeclarations(source)).toEqual([{ line: 2, title: 'a' }])
    expect(maskNonCode(source)).toContain('test(')
  })

  // Protects Review Focus 1: a regex after a keyword, ) or => is a regex, so a backtick inside it does not open a template literal.
  test('a regex after a keyword, ) and => does not open a template literal', () => {
    for (const keyword of ['return', 'typeof', 'case', 'else', 'do', 'in', 'of', 'delete', 'void', 'yield', 'await']) {
      expect(scanSource(`${keyword} /${q}/.test(s)`).unterminated, keyword).toBe(false)
    }
    for (const row of [`if (x) /${q}/.test(s)`, `const f = (s: string) => /${q}/.test(s)`]) {
      expect(scanSource(row).unterminated, row).toBe(false)
    }
  })

  // Protects fail-closed behaviour: an unterminated block comment or template literal is reported by the scan.
  test('scanSource reports an unterminated block comment or template literal', () => {
    expect(scanSource('/* open').unterminated).toBe(true)
    expect(scanSource(`const t = ${q}open`).unterminated).toBe(true)
    expect(scanSource(`const t = ${q}closed${q} /* c */`).unterminated).toBe(false)
  })
})

describe('speed', () => {
  // Protects the command's usability: line numbers are computed in one pass, not once per declaration.
  test('5,000 generated tests are scanned in under a second', () => {
    const source = Array.from({ length: 5000 }, (_, n) => `// Protects: r\ntest('t${n}', () => { expect(${n}).toBe(${n}) })`).join('\n')
    const started = Date.now()
    const found = findDeclarations(source)
    expect(found).toHaveLength(5000)
    expect(found[4999]).toEqual({ line: 10000, title: 't4999' })
    expect(Date.now() - started).toBeLessThan(1000)
  })
})
