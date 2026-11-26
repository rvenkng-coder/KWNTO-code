import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

// The hook helpers are CommonJS so PocketBase can require() them; load them the same way.
const require = createRequire(import.meta.url)
const { productionSettings } = require('../../backend/pb_hooks/lib/production-settings.js') as {
  productionSettings: (env: Record<string, string | undefined>) => unknown
}

// Protects security.md 3: the rate limits and trusted proxy are written only in production, and only
// with an https public URL, or the dev and test backends rate-limit and mail links are wrong.
test('production settings are only produced for KWNTO_PRODUCTION=1 with an https URL', () => {
  expect(productionSettings({})).toBeNull()
  expect(productionSettings({ KWNTO_PRODUCTION: 'true', KWNTO_PUBLIC_URL: 'https://a.ts.net' })).toBeNull()
  expect(productionSettings({ KWNTO_PRODUCTION: '1', KWNTO_PUBLIC_URL: 'https://a.ts.net/' })).toEqual({
    meta: { appURL: 'https://a.ts.net', appName: 'KWNTO' },
    rateLimits: {
      enabled: true,
      rules: [
        { label: '*:auth', maxRequests: 2, duration: 3 },
        { label: '/api/kwnto/teams/', maxRequests: 10, duration: 60 },
        { label: '/api/', maxRequests: 300, duration: 10 },
      ],
    },
    trustedProxy: { headers: ['X-Forwarded-For'], useLeftmostIP: false },
    backups: { cron: '0 2 * * *', cronMaxKeep: 7 },
  })
  const message = 'KWNTO_PUBLIC_URL must start with https://'
  expect(() => productionSettings({ KWNTO_PRODUCTION: '1', KWNTO_PUBLIC_URL: 'http://a.ts.net' })).toThrow(message)
  expect(() => productionSettings({ KWNTO_PRODUCTION: '1' })).toThrow(message)
})
