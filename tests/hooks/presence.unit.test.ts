import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

// The hook helpers are CommonJS so PocketBase can require() them; load them the same way.
const require = createRequire(import.meta.url)
const { staleCutoffIso } = require('../../backend/pb_hooks/lib/presence.js') as {
  staleCutoffIso: (nowMs: number, timeoutSeconds: number) => string
}

const NOW = Date.parse('2026-11-20T12:00:00.000Z')

// Protects plan D14: a presence row is kept for twice the admin's timeout (a heartbeat or two
// may be late) and then removed; the cut-off is in the stored datetime text, so it compares
// correctly with `updated`; a timeout of 0 means "now".
test('presence rows go stale after twice the timeout', () => {
  expect(staleCutoffIso(NOW, 30)).toBe('2026-11-20 11:59:00.000Z')
  expect(staleCutoffIso(NOW, 1)).toBe('2026-11-20 11:59:58.000Z')
  expect(staleCutoffIso(NOW, 0)).toBe('2026-11-20 12:00:00.000Z')
  expect(staleCutoffIso(NOW + 1, 30)).toBe('2026-11-20 11:59:00.001Z')
})
