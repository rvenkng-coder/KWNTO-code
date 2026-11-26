import { ESLint } from 'eslint'
import { expect, test } from 'vitest'

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await new ESLint().lintText(code, { filePath })
  return (result?.messages ?? []).map((m) => m.ruleId ?? 'parse-error')
}

// Each test protects one rule in docs/engineering.md section 2 or docs/security.md section 5.

// Protects "one door to the backend": only frontend/src/backend/ may import the PocketBase SDK, so the
// backend stays swappable (design section 7).
test('pocketbase may not be imported outside frontend/src/backend', async () => {
  expect(await ruleIds(`import PocketBase from 'pocketbase'`, 'frontend/src/features/canvas/a.ts')).toContain(
    'no-restricted-imports',
  )
  expect(
    await ruleIds(`import PocketBase from 'pocketbase'\nexport default PocketBase`, 'frontend/src/backend/client.ts'),
  ).not.toContain('no-restricted-imports')
})

// Protects security.md section 5: user text is rendered as plain text, never as HTML.
test('dangerouslySetInnerHTML is banned', async () => {
  expect(
    await ruleIds(
      `export const A = () => <p dangerouslySetInnerHTML={{ __html: 'x' }} />`,
      'frontend/src/features/canvas/A.tsx',
    ),
  ).toContain('no-restricted-syntax')
})

// Protects strict TypeScript: no untyped escape hatch without a written reason.
test('any is banned', async () => {
  expect(await ruleIds(`export const a: any = 1`, 'frontend/src/features/canvas/a.ts')).toContain(
    '@typescript-eslint/no-explicit-any',
  )
})

// Protects "small files": 300 lines is the limit, 301 is over it.
test('files over 300 lines are rejected, 300 is allowed', async () => {
  const lines = (n: number) => Array.from({ length: n }, (_, i) => `export const v${i} = ${i}`).join('\n') + '\n'
  expect(await ruleIds(lines(301), 'frontend/src/features/canvas/big.ts')).toContain('max-lines')
  expect(await ruleIds(lines(300), 'frontend/src/features/canvas/ok.ts')).not.toContain('max-lines')
})

// Protects the backend hooks, which no typecheck covers: a misspelled name fails lint, not a request at run time.
test('an undefined name in a hook is rejected, the PocketBase globals are known', async () => {
  const hook = (body: string) => `onRecordCreate((e) => { ${body} }, 'media')\n`
  expect(await ruleIds(hook('ee.next()'), 'backend/pb_hooks/a.pb.js')).toContain('no-undef')
  expect(await ruleIds(hook('require(`${__hooks}/lib/a.js`); e.next()'), 'backend/pb_hooks/a.pb.js')).toEqual([])
})

// Protects the same rule for test files, which hold many cases of one module: 500 lines.
test('a test file may have 500 lines, not 501', async () => {
  const lines = (n: number) => Array.from({ length: n }, (_, i) => `export const v${i} = ${i}`).join('\n') + '\n'
  expect(await ruleIds(lines(501), 'frontend/src/features/canvas/big.test.ts')).toContain('max-lines')
  expect(await ruleIds(lines(500), 'frontend/src/features/canvas/ok.test.ts')).not.toContain('max-lines')
})
