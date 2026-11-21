import { expect, test } from 'vitest'
import { exportPixelRatio, isSmallText } from '../../../../frontend/src/features/editor/export/exportPlan'

// Protects: tiny and huge maps both give a positive ratio at most 2 whose image fits the canvas limits.
test('[C3] empty-one-huge: ratio stays inside the limits for any size', () => {
  const sizes: Array<[number, number]> = [[1, 1], [80, 80], [1e6, 1e6], [1e6, 1], [1, 1e6], [8192, 8192], [5657, 5657], [-5, 10], [10, -5]]
  for (const [w, h] of sizes) {
    const r = exportPixelRatio(w, h)
    expect(r).toBeGreaterThan(0)
    expect(r).toBeLessThanOrEqual(2)
    if (w > 0 && h > 0) {
      expect(w * r).toBeLessThanOrEqual(8192 + 1e-6)
      expect(h * r).toBeLessThanOrEqual(8192 + 1e-6)
      expect(w * r * h * r).toBeLessThanOrEqual(32_000_000 + 1)
    }
  }
})

// Protects: the small-text warning appears for a giant map and not for an ordinary one.
test('[C3] relative-of-fixed-case: a giant map warns, an ordinary one does not', () => {
  expect(isSmallText(exportPixelRatio(40000, 40000))).toBe(true)
  expect(isSmallText(exportPixelRatio(1200, 800))).toBe(false)
  expect(isSmallText(0)).toBe(true)
})
