import { expect, test } from 'vitest'
import { parseRoute } from '../../../../frontend/src/features/shell/routes'

// Probe for C4: project route without a chapter.
// Protects: a project route with anything after the id but a chapter.
test('[C4] relative-of-fixed-case: a project route with anything after the id but a chapter', () => {
  for (const h of ['#/project/abcdefghijk0123/foo', '#/project/abcdefghijk0123/foo/bar', '#/project/abcdefghijk0123/chapter/zyxwvutsrq98765/x', '#/project/abcdefghijk0123/?x=1']) {
    expect(parseRoute(h), h).toEqual({ name: 'teams' })
  }
})

// Protects: one trailing slash is tolerated.
test('[C4] relative-of-fixed-case: one trailing slash is tolerated', () => {
  expect(parseRoute('#/project/abcdefghijk0123/')).toEqual({ name: 'project', projectId: 'abcdefghijk0123', chapterId: null })
  expect(parseRoute('#/project/abcdefghijk0123/chapter/zyxwvutsrq98765/')).toEqual({ name: 'project', projectId: 'abcdefghijk0123', chapterId: 'zyxwvutsrq98765' })
})

// Protects: a capital Project prefix is not a project route.
test('[C4] case-and-whitespace: a capital Project prefix is not a project route', () => {
  expect(parseRoute('#/Project/abcdefghijk0123')).toEqual({ name: 'teams' })
  expect(parseRoute('#/project')).toEqual({ name: 'teams' })
})
