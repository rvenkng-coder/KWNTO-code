import { expect, test } from 'vitest'
import { exportPixelRatio, isSmallText } from '../../../../frontend/src/features/editor/export/exportPlan'

// Protects: a map 40,000 px wide, or just as tall, fits in 8192 px and is flagged small; a map that fits at full ratio is not.
test('[C5] empty-one-huge: very wide and very tall maps are scaled and flagged', () => {
  for (const [w, h] of [[40080, 300], [300, 40080], [40080, 40080]] as const) {
    const r = exportPixelRatio(w, h)
    expect(Math.round(w * r)).toBeLessThanOrEqual(8192)
    expect(Math.round(h * r)).toBeLessThanOrEqual(8192)
    expect(isSmallText(r)).toBe(true)
  }
  expect(isSmallText(exportPixelRatio(4000, 3000))).toBe(false)
})
