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
  expect(parseRoute('#/project/abcdefghijk0123')).toEqual({ name: 'project', projectId: 'abcdefghijk0123', chapterId: null })
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
  expect(
    parseRoute('#/project/abcdefghijk0123/chapter/zyxwvutsrq98765/extra')
  ).toEqual({ name: 'teams' })
})

// Protects: a project hash with only the word "chapter" and no chapter id must fall
// back to teams (the chapter segment requires a valid id after it).
test('project chapter without an id falls back to teams', () => {
  expect(parseRoute('#/project/abcdefghijk0123/chapter')).toEqual({ name: 'teams' })
})
