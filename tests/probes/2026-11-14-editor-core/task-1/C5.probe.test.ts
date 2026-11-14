import { expect, test } from 'vitest'
import { parseRoute } from '../../../../frontend/src/features/shell/routes'

// Probe for C5: invalid ids fall back.
// Protects: symbols, spaces, newlines and non-ASCII in an id.
test('[C5] case-and-whitespace: symbols, spaces, newlines and non-ASCII in an id', () => {
  for (const id of ['abcdefghijk012-', 'abcdefghijk012_', 'abcdefghijk012.', 'abcdefghijk01 3', 'abcdefghijk012\n', '\nabcdefghijk012', 'abcdefghijk012é', 'abcdefghijk012%', '../../abcdefghi']) {
    expect(parseRoute('#/team/' + id), JSON.stringify(id)).toEqual({ name: 'teams' })
    expect(parseRoute('#/project/' + id), JSON.stringify(id)).toEqual({ name: 'teams' })
  }
})

// Protects: a huge id and a huge number of segments do not throw.
test('[C5] empty-one-huge: a huge id and a huge number of segments do not throw', () => {
  expect(parseRoute('#/team/' + 'a'.repeat(100000))).toEqual({ name: 'teams' })
  expect(parseRoute('#/project/' + Array(5000).fill('abcdefghijk0123').join('/'))).toEqual({ name: 'teams' })
})

// Protects: an id with a newline at the end is still invalid.
test('[C5] helper-hides-bug: an id with a newline at the end is still invalid', () => {
  expect(parseRoute('#/team/abcdefghijk0123\n')).toEqual({ name: 'teams' })
})
