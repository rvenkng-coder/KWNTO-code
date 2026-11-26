import { expect, test } from 'vitest'
import { parseRoute, routeToHash } from './routes'

// Protects: empty, bare # and #/ all resolve to the default teams list so the app
// never crashes on a blank hash or a first-time visit.
test('empty and root hashes are the teams list', () => {
  expect(parseRoute('')).toEqual({ name: 'teams' })
  expect(parseRoute('#')).toEqual({ name: 'teams' })
  expect(parseRoute('#/')).toEqual({ name: 'teams' })
})

// Protects: a team hash with a valid 15-char PocketBase id must produce the team route.
test('a team hash gives the team route', () => {
  expect(parseRoute('#/team/abcdefghijk0123')).toEqual({ name: 'team', teamId: 'abcdefghijk0123' })
})

// Protects: a project hash with a chapter must carry both ids through parseRoute.
test('a project hash with a chapter gives both ids', () => {
  const result = parseRoute('#/project/abcdefghijk0123/chapter/zyxwvutsrq98765')
  expect(result).toEqual({ name: 'project', projectId: 'abcdefghijk0123', chapterId: 'zyxwvutsrq98765' })
})

// Protects: a project hash without a chapter must set chapterId to null.
test('a project hash without a chapter gives a null chapter', () => {
  expect(parseRoute('#/project/abcdefghijk0123')).toEqual({
    name: 'project',
    projectId: 'abcdefghijk0123',
    chapterId: null,
  })
})

// Protects: any id that does not match the 15-char a-z0-9 PocketBase format must fall
// back to the teams list instead of leaking garbage into the route state.
test('an invalid id falls back to the teams list', () => {
  expect(parseRoute('#/team/ABCDEFGHIJK0123')).toEqual({ name: 'teams' }) // uppercase
  expect(parseRoute('#/team/abcdefghijk012')).toEqual({ name: 'teams' }) // 14 chars
  expect(parseRoute('#/team/abcdefghijk01234')).toEqual({ name: 'teams' }) // 16 chars
  expect(parseRoute('#/team/abc%20def0123')).toEqual({ name: 'teams' }) // %20
  expect(parseRoute('#/team/')).toEqual({ name: 'teams' }) // empty id
})

// Protects: one trailing slash on a valid route is tolerated; extra segments or unknown
// prefixes must fall back to teams.
test('one trailing slash is allowed and extra segments are not', () => {
  expect(parseRoute('#/team/abcdefghijk0123/')).toEqual({ name: 'team', teamId: 'abcdefghijk0123' })
  expect(parseRoute('#/team/abcdefghijk0123/x')).toEqual({ name: 'teams' })
  expect(parseRoute('#/unknown')).toEqual({ name: 'teams' })
})

// Protects: every route shape must survive a round trip through parseRoute → routeToHash
// → parseRoute so the hash and the parsed object stay in sync.
test('routeToHash and parseRoute round-trip', () => {
  const routes = [
    { name: 'teams' } as const,
    { name: 'team', teamId: 'abcdefghijk0123' } as const,
    { name: 'project', projectId: 'abcdefghijk0123', chapterId: null } as const,
    { name: 'project', projectId: 'abcdefghijk0123', chapterId: 'zyxwvutsrq98765' } as const,
  ]
  for (const r of routes) {
    expect(parseRoute(routeToHash(r))).toEqual(r)
  }
})

// Protects: extra segments after a project route or a project chapter route must fall
// back to teams instead of being silently accepted as valid routes.
test('extra segments after a project or chapter route fall back to teams', () => {
  expect(parseRoute('#/project/abcdefghijk0123/extra')).toEqual({ name: 'teams' })
  expect(parseRoute('#/project/abcdefghijk0123/chapter/zyxwvutsrq98765/extra')).toEqual({ name: 'teams' })
})

// Protects: a project hash with only the word "chapter" and no chapter id must fall
// back to teams (the chapter segment requires a valid id after it).
test('project chapter without an id falls back to teams', () => {
  expect(parseRoute('#/project/abcdefghijk0123/chapter')).toEqual({ name: 'teams' })
})

// Protects D8: a share address carries a 40-character token of letters and digits and
// nothing else; a short token, a long one or one with another character is not a share route.
test('a share hash needs a 40-character token', () => {
  const token = 'aB3'.repeat(13) + 'x'
  expect(token).toHaveLength(40)
  expect(parseRoute(`#/s/${token}`)).toEqual({ name: 'share', token })
  expect(routeToHash({ name: 'share', token })).toBe(`#/s/${token}`)
  expect(parseRoute(`#/s/${token.slice(1)}`)).toEqual({ name: 'teams' })
  expect(parseRoute(`#/s/${token.slice(1)}-`)).toEqual({ name: 'teams' })
})

// Protects Plan 6 D9 / C1: the verify and reset links carry only a JWT-shaped value (three
// dot-separated URL-safe parts, at most 2048 characters); anything else is the teams list, so a
// crafted link cannot put arbitrary text into the route or the request that follows.
test('verify and reset links carry only a token-shaped value', () => {
  expect(parseRoute('#/verify/aaa.bbb.ccc')).toEqual({ name: 'verify', token: 'aaa.bbb.ccc' })
  expect(parseRoute('#/reset/a-b.c_d.e')).toEqual({ name: 'reset', token: 'a-b.c_d.e' })
  expect(parseRoute(`#/verify/${'a'.repeat(2049 - 4)}.b.c`)).toEqual({ name: 'teams' }) // 2049 chars
  expect(parseRoute(`#/verify/${'a'.repeat(2048 - 4)}.b.c`)).toEqual({
    name: 'verify',
    token: `${'a'.repeat(2044)}.b.c`,
  }) // 2048 chars
  expect(parseRoute('#/verify/aaa.bbb')).toEqual({ name: 'teams' })
  expect(parseRoute('#/reset/a.b.c/extra')).toEqual({ name: 'teams' })
  expect(parseRoute('#/verify/<script>.b.c')).toEqual({ name: 'teams' })
  for (const r of [{ name: 'verify', token: 'aaa.bbb.ccc' } as const, { name: 'reset', token: 'a-b.c_d.e' } as const]) {
    expect(parseRoute(routeToHash(r))).toEqual(r)
  }
})
