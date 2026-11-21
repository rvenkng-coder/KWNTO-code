import { expect, test } from 'vitest'
import { parseRoute, routeToHash } from '../../../../frontend/src/features/shell/routes'

const TEAMS = { name: 'teams' }
const seg = (n: number) => 'a'.repeat(n)

// Protects: the token shape that reaches the screens; every bad shape is the teams fallback.
test('[C1] malformed-input: anything that is not a three-part token falls back to teams', () => {
  const bad = [
    '#/verify/', '#/verify', '#/reset/', '#/verify/aaa', '#/verify/aaa.bbb', '#/verify/aaa.bbb.', '#/verify/.bbb.ccc',
    '#/verify/aaa..ccc', '#/verify/a.b.c.d', '#/reset/a.b.c/extra', '#/reset/a b.c.d', '#/verify/a+b.c.d',
    '#/verify/a%20b.c.d', '#/verify/<script>.b.c', '#/reset/a.b.c%2F', '#/verify/a.b.c?x=1', '#/verify//a.b.c',
  ]
  for (const h of bad) expect(parseRoute(h), h).toEqual(TEAMS)
})

// Protects: valid tokens of each character class parse and come back out unchanged.
test('[C1] case-and-whitespace: valid tokens round-trip with case and - _ kept', () => {
  for (const [kind, t] of [['verify', 'aaa.bbb.ccc'], ['reset', 'a-b.c_d.e'], ['verify', 'AbC-_9.XyZ.0'], ['reset', 'Z.Z.Z']] as const) {
    const route = parseRoute(`#/${kind}/${t}`)
    expect(route).toEqual({ name: kind, token: t })
    expect(parseRoute(routeToHash(route))).toEqual(route)
  }
})

// Protects: the 2048 limit applies to the whole token, exactly.
test('[C1] numeric-extremes: 2048 characters is allowed and 2049 is not', () => {
  const at = `${seg(1000)}.${seg(1000)}.${seg(46)}` // 1000+1+1000+1+46 = 2048
  const over = `${seg(1000)}.${seg(1000)}.${seg(47)}`
  expect(at.length).toBe(2048)
  expect(parseRoute(`#/verify/${at}`)).toEqual({ name: 'verify', token: at })
  expect(parseRoute(`#/reset/${over}`)).toEqual(TEAMS)
  expect(parseRoute(`#/verify/${'a.'.repeat(100000)}b`)).toEqual(TEAMS)
})

// Protects: existing routes are unchanged by the new ones.
test('[C1] idempotence: old routes still parse and a trailing slash on a token is tolerated like the others', () => {
  expect(parseRoute('#/')).toEqual(TEAMS)
  expect(parseRoute('#/team/abcdefghij12345')).toEqual({ name: 'team', teamId: 'abcdefghij12345' })
  expect(parseRoute('#/verify/a.b.c/')).toEqual({ name: 'verify', token: 'a.b.c' })
})
