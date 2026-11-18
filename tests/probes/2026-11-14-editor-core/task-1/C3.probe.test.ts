import { expect, test } from 'vitest'
import { parseRoute } from '../../../../frontend/src/features/shell/routes'

// Probe for C3: project route with a chapter.
// Protects: nothing may follow a chapter id.
test('[C3] relative-of-fixed-case: nothing may follow a chapter id', () => {
  for (const h of ['#/project/abcdefghijk0123/chapter/zyxwvutsrq98765/extra', '#/project/abcdefghijk0123/chapter/zyxwvutsrq98765/extra/more', '#/project/abcdefghijk0123/chapter/zyxwvutsrq98765/chapter/abcdefghijk0123', '#/project/abcdefghijk0123/chapter/zyxwvutsrq98765//']) {
    expect(parseRoute(h), h).toEqual({ name: 'teams' })
  }
})

// Protects: a good project id followed by a bad chapter id.
test('[C3] second-bad-item: a good project id followed by a bad chapter id', () => {
  for (const h of ['#/project/abcdefghijk0123/chapter/ZYXWVUTSRQ98765', '#/project/abcdefghijk0123/chapter/zyxwvutsrq9876', '#/project/abcdefghijk0123/chapter/zyxwvutsrq987654', '#/project/abcdefghijk0123/chapter/', '#/project/abcdefghijk0123/chapter']) {
    expect(parseRoute(h), h).toEqual({ name: 'teams' })
  }
})

// Protects: bad project id and bad chapter id.
test('[C3] two-bad-items: bad project id and bad chapter id', () => {
  expect(parseRoute('#/project/short/chapter/short')).toEqual({ name: 'teams' })
})

// Protects: the word chapter must be exactly lower case.
test('[C3] case-and-whitespace: the word chapter must be exactly lower case', () => {
  for (const h of ['#/project/abcdefghijk0123/Chapter/zyxwvutsrq98765', '#/project/abcdefghijk0123/CHAPTER/zyxwvutsrq98765', '#/project/abcdefghijk0123/chapters/zyxwvutsrq98765', '#/project/abcdefghijk0123/ chapter/zyxwvutsrq98765']) {
    expect(parseRoute(h), h).toEqual({ name: 'teams' })
  }
})
