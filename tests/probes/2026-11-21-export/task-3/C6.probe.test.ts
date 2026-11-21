import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, expect, test } from 'vitest'
import { applyTheme, ThemeOverride, useTheme } from '../../../../frontend/src/features/shell/theme'

function Probe() {
  return createElement('b', null, useTheme())
}
const render = (override: 'light' | 'dark' | null) =>
  renderToString(createElement(ThemeOverride.Provider, { value: override }, createElement(Probe)))

afterEach(() => {
  // @ts-expect-error the probe runs without a DOM; the theme module only needs this one property
  delete globalThis.document
})

// Protects: inside the light override a dark account still reads light; outside it, the account's theme is read.
test('[C6] wrong-actor: the override wins over the account theme and does not leak outside', () => {
  // @ts-expect-error a minimal document so applyTheme can set the attribute
  globalThis.document = { documentElement: { dataset: {} } }
  applyTheme('dark')
  expect(render('light')).toContain('light')
  expect(render(null)).toContain('dark')
  expect(render('dark')).toContain('dark')
  applyTheme('light')
  expect(render(null)).toContain('light')
})
