import { expect, test } from 'vitest'
import { fitInto, scopesFor } from '../../../../frontend/src/features/editor/export/exportPlan'

// Protects: the fitted size keeps the aspect, never overflows the box, and touches it on one side, for any shape.
test('[C4] empty-one-huge: fitting any shape into a box', () => {
  const box = { width: 300, height: 200 }
  for (const [w, h] of [[1, 1], [1, 1000], [1000, 1], [300, 200], [3000, 2000], [7, 3]]) {
    const f = fitInto(w, h, box)
    expect(f.width).toBeLessThanOrEqual(300 + 1e-9)
    expect(f.height).toBeLessThanOrEqual(200 + 1e-9)
    expect(f.width / f.height).toBeCloseTo(w / h, 9)
    expect(Math.max(f.width / 300, f.height / 200)).toBeCloseTo(1, 9)
  }
})

// Protects: the scope list is a fresh array each call, so a caller cannot change it for the next one.
test('[C4] stale-after-change: mutating the returned scopes does not leak', () => {
  scopesFor('pdf').push('chapter')
  expect(scopesFor('pdf')).toEqual(['chapter', 'project'])
})
