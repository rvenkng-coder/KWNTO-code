import { expect, test } from 'vitest'
import { parseRoute } from '../../../../frontend/src/features/shell/routes'

// Probe for C1: empty or root hash is the teams list.
// Protects: nothing, only slashes, and a very long junk hash.
test('[C1] empty-one-huge: nothing, only slashes, and a very long junk hash', () => {
  for (const h of ['', '#', '#/', '#//', '#///', '/', '#' + '/'.repeat(500), '#/' + 'x'.repeat(100000)]) {
    expect(parseRoute(h), JSON.stringify(h.slice(0, 20))).toEqual({ name: 'teams' })
  }
})

// Protects: spaces and capitals around the root are not a route.
test('[C1] case-and-whitespace: spaces and capitals around the root are not a route', () => {
  for (const h of [' ', '# ', '#/ ', '#/TEAM', '#/Team/abcdefghijk0123']) {
    expect(parseRoute(h), h).toEqual({ name: 'teams' })
  }
})
