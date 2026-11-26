import { expect, test } from 'vitest'
import { codeWithoutComments, findHistoryRefs } from './comment-refs.ts'

const found = (source: string) => findHistoryRefs('a.ts', source).map((r) => r.match)

// Protects: a comment that points at old project history is reported, in file order.
test('a plan, task, decision, case or finding reference in a comment is reported', () => {
  const source = [
    '// plan Task 8',
    '/* D12 and (C4) */',
    'const a = 1 // finding B',
    '// Review Focus 3',
    '// offline sync plan, M10',
  ].join('\n')
  expect(found(source)).toEqual(['Task 8', 'D12', 'C4', 'finding B', 'Review Focus', 'offline sync plan', 'M10'])
})

// Protects: living documents may be cited, and text that is not a comment is never reported.
test('design references and text outside comments are allowed', () => {
  expect(found("// The newer save wins (design 6.7, decision 0002).\nconst t = 'Task 8 D12'")).toEqual([])
})

// Protects: the report names the line of the reference, also inside a block comment and inside JSX.
test('each reference carries its line', () => {
  const source = 'export const B = () => (\n  <div>\n    {/*\n      plan 2026-11-26-player-mode\n    */}\n  </div>\n)'
  expect(findHistoryRefs('a.tsx', source)).toEqual([{ line: 4, match: 'plan 2026-11-26-player-mode' }])
})

// Protects: rewriting, adding or removing comments leaves the compared code the same.
test('a comment-only change leaves the code the same', () => {
  const before = '// old\nexport const a = 1\nexport const B = () => <div>{/* old */}</div>'
  const after = '// new reason\n// second line\nexport const a = 1\nexport const B = () => <div></div>'
  expect(codeWithoutComments('a.tsx', after)).toBe(codeWithoutComments('a.tsx', before))
})

// Protects: any change to the code itself is seen.
test('a code change is not the same code', () => {
  expect(codeWithoutComments('a.ts', 'const a = 2')).not.toBe(codeWithoutComments('a.ts', 'const a = 1'))
})

// Protects: text on screen that looks like a comment is code, not a comment.
test('slashes in JSX text are not a comment', () => {
  const source = 'export const B = () => <p>// Task 8</p>'
  expect(findHistoryRefs('a.tsx', source)).toEqual([])
  expect(codeWithoutComments('a.tsx', source)).toContain('// Task 8')
})

// Protects: removing a comment on its own line inside JSX is not a code change, but removing words is.
test('a JSX comment on its own line can be removed', () => {
  const element = (inner: string) => `export const B = () => (\n  <div>\n${inner}    <a />\n  </div>\n)`
  const bare = codeWithoutComments('a.tsx', element(''))
  expect(codeWithoutComments('a.tsx', element('    {/* old */}\n'))).toBe(bare)
  expect(codeWithoutComments('a.tsx', element('    words\n'))).not.toBe(bare)
})
