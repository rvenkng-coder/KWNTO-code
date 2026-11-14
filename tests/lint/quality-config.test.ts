import { ESLint } from 'eslint'
import { describe, expect, test } from 'vitest'

const eslint = new ESLint({ overrideConfigFile: 'eslint.quality.config.js', cwd: process.cwd() })

async function rulesFor(path: string, source: string): Promise<string[]> {
  const [result] = await eslint.lintText(source, { filePath: path })
  return result.messages.map((message) => message.ruleId ?? `parse error: ${message.message}`)
}

// n statements inside one function; the function is n + 2 lines long (header and closing brace)
function fn(statements: number, name = 'f'): string {
  return `function ${name}() {\n${'  doIt()\n'.repeat(statements)}}\n`
}
function component(statements: number): string {
  return `export function C() {\n${'  doIt()\n'.repeat(statements)}  return <div />\n}\n`
}
const nested = (depth: number): string => `function f(a) {\n${'if (a) {\n'.repeat(depth)}  doIt()\n${'}\n'.repeat(depth)}}\n`

describe('quality limits', () => {
  // Protects: a function one line over the limit is reported, so long functions are split.
  test('a 51-line function in src/ fails max-lines-per-function', async () => {
    expect(await rulesFor('frontend/src/a.ts', fn(49))).toContain('max-lines-per-function')
  })

  // Protects: the limit is inclusive, so the check does not flag code that is within it.
  test('a 50-line function passes', async () => {
    expect(await rulesFor('frontend/src/a.ts', fn(48))).toEqual([])
  })

  // Protects: blank lines and comments do not count towards the function length.
  test('blank lines and comments are not counted', async () => {
    const padded = `function f() {\n${'  // note\n\n'.repeat(40)}${'  doIt()\n'.repeat(10)}}\n`
    expect(await rulesFor('frontend/src/a.ts', padded)).toEqual([])
  })

  // Protects: a .tsx component gets the larger 80-line allowance, and only that much.
  test('a 60-line .tsx component passes and a 81-line one fails', async () => {
    expect(await rulesFor('frontend/src/C.tsx', component(57))).toEqual([])
    expect(await rulesFor('frontend/src/C.tsx', component(77))).toEqual([])
    expect(await rulesFor('frontend/src/C.tsx', component(78))).toContain('max-lines-per-function')
  })

  // Protects: the complexity limit is exactly 10.
  test('complexity 11 fails and 10 passes', async () => {
    const withBranches = (n: number): string => `function f(a) {\n${'  if (a) doIt()\n'.repeat(n)}}\n`
    expect(await rulesFor('frontend/src/a.ts', withBranches(9))).toEqual([])
    expect(await rulesFor('frontend/src/a.ts', withBranches(10))).toContain('complexity')
  })

  // Protects: deep nesting is reported at depth 5 and not at 4.
  test('nesting depth 5 fails', async () => {
    expect(await rulesFor('frontend/src/a.ts', nested(4))).toEqual([])
    expect(await rulesFor('frontend/src/a.ts', nested(5))).toContain('max-depth')
  })

  // Protects: long parameter lists are reported at 6.
  test('6 parameters fail', async () => {
    expect(await rulesFor('frontend/src/a.ts', 'function f(a, b, c, d, e) { return a }\n')).toEqual([])
    expect(await rulesFor('frontend/src/a.ts', 'function f(a, b, c, d, e, g) { return a }\n')).toContain('max-params')
  })

  // Protects: console is banned in the app and hooks but scripts print by design.
  test('console.log in src/ fails and in scripts/ passes', async () => {
    expect(await rulesFor('frontend/src/a.ts', 'console.log(1)\n')).toContain('no-console')
    expect(await rulesFor('backend/pb_hooks/lib/a.js', 'console.log(1)\n')).toContain('no-console')
    expect(await rulesFor('scripts/a.ts', 'console.log(1)\n')).toEqual([])
  })

  // Protects: a forgotten debugger statement is reported in every folder.
  test('debugger fails everywhere', async () => {
    for (const path of ['frontend/src/a.ts', 'scripts/a.ts', 'backend/pb_hooks/a.js']) {
      expect(await rulesFor(path, 'debugger\n')).toContain('no-debugger')
    }
  })

  // Protects: CommonJS hook files parse (require, module.exports) and get the same limits.
  test('a .js pb_hook lib file with the same problems fails (CommonJS, require and module.exports parse)', async () => {
    const source = `const x = require('./x.js')\nmodule.exports = ${fn(49).replace('function f()', 'function ()')}`
    const rules = await rulesFor('backend/pb_hooks/lib/a.js', `${source.trimEnd()}\nconsole.log(x)\n`)
    expect(rules).toContain('max-lines-per-function')
    expect(rules).toContain('no-console')
    expect(rules.some((rule) => rule.startsWith('parse error'))).toBe(false)
  })

  // Protects: a file that cannot be parsed is reported, never passed silently.
  test('a syntax error is reported as a problem', async () => {
    expect((await rulesFor('frontend/src/a.ts', 'function (\n')).length).toBeGreaterThan(0)
  })

  // Protects: an empty file is not a problem and does not crash the linter.
  test('an empty file passes', async () => {
    expect(await rulesFor('frontend/src/a.ts', '')).toEqual([])
  })
})
