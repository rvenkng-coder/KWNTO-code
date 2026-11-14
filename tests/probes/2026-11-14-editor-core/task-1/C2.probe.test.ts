import { expect, test } from 'vitest'
import { parseRoute } from '../../../../frontend/src/features/shell/routes'

// Probe for C2: team route.
// Protects: capitals, spaces and encoded forms of a team route are rejected.
test('[C2] case-and-whitespace: capitals, spaces and encoded forms of a team route are rejected', () => {
  for (const h of ['#/Team/abcdefghijk0123', '#/TEAM/abcdefghijk0123', '#/team/ abcdefghijk0123', '#/team/abcdefghijk0123 ', '#/team/%61bcdefghijk0123', '#/team/ábcdefghijk0123']) {
    expect(parseRoute(h), h).toEqual({ name: 'teams' })
  }
})

// Protects: another valid id and every digit/letter mix.
test('[C2] relative-of-fixed-case: another valid id and every digit/letter mix', () => {
  expect(parseRoute('#/team/zyxwvutsrq98765')).toEqual({ name: 'team', teamId: 'zyxwvutsrq98765' })
  expect(parseRoute('#/team/000000000000000')).toEqual({ name: 'team', teamId: '000000000000000' })
  expect(parseRoute('#/team/aaaaaaaaaaaaaaa')).toEqual({ name: 'team', teamId: 'aaaaaaaaaaaaaaa' })
})
