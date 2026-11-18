import { expect, test } from 'vitest'
import { parseRoute } from '../../../../frontend/src/features/shell/routes'

// Probe for C6: trailing slash and extra segments.
// Protects: extra segments after a team route.
test('[C6] two-bad-items: extra segments after a team route', () => {
  for (const h of ['#/team/abcdefghijk0123/x/y', '#/team/abcdefghijk0123/zyxwvutsrq98765', '#/team/abcdefghijk0123//', '#/team/abcdefghijk0123/x/']) {
    expect(parseRoute(h), h).toEqual({ name: 'teams' })
  }
})

// Protects: unknown prefixes and prefixes of known words.
test('[C6] relative-of-fixed-case: unknown prefixes and prefixes of known words', () => {
  for (const h of ['#/unknown/abcdefghijk0123', '#/teams/abcdefghijk0123', '#/team', '#/teamx/abcdefghijk0123', '#/projects/abcdefghijk0123', '#/#/team/abcdefghijk0123']) {
    expect(parseRoute(h), h).toEqual({ name: 'teams' })
  }
})
