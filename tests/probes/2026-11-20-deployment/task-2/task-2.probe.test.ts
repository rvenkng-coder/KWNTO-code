import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

const require = createRequire(import.meta.url)
const { productionSettings } = require('../../../../backend/pb_hooks/lib/production-settings.js') as {
  productionSettings: (env: Record<string, string | undefined>) => unknown
}

const ok = { KWNTO_PRODUCTION: '1', KWNTO_PUBLIC_URL: 'https://kwnto.example.ts.net' }

// Protects: the flag gates everything, whatever else is in the environment.
test('[C1] case-and-whitespace: only the exact flag value "1" turns production on', () => {
  for (const flag of ['', '0', 'true', 'yes', ' 1', '1 ', '01', undefined]) {
    const env = { KWNTO_PRODUCTION: flag, KWNTO_PUBLIC_URL: 'https://a.ts.net' }
    expect(productionSettings(env), JSON.stringify(flag)).toBeNull()
  }
  expect(productionSettings({ KWNTO_PUBLIC_URL: 'https://a.ts.net' })).toBeNull()
})

// Protects: a bad URL is refused with the exact message, and the flag off ignores a bad URL.
test('[C1] malformed-input: urls that are not https are refused with the exact message', () => {
  const bad = [undefined, '', 'http://a.ts.net', 'ftp://a.ts.net', 'a.ts.net', 'https://', 'https:///x', 'https:// a.ts.net', ' https://a.ts.net', 'HTTP://a.ts.net']
  for (const url of bad) {
    expect(() => productionSettings({ KWNTO_PRODUCTION: '1', KWNTO_PUBLIC_URL: url }), String(url)).toThrow('KWNTO_PUBLIC_URL must start with https://')
  }
  expect(productionSettings({ KWNTO_PRODUCTION: '0', KWNTO_PUBLIC_URL: 'http://a' })).toBeNull()
})

// Protects: the URL is normalised (one trailing slash dropped) and the values are the D7/D6/D10 ones.
test('[C1] boundary-inputs: the full settings object, in order, with the url normalised', () => {
  const r = productionSettings(ok) as any
  expect(r.meta).toEqual({ appURL: 'https://kwnto.example.ts.net', appName: 'KWNTO' })
  expect(r.rateLimits).toEqual({
    enabled: true,
    rules: [
      { label: '*:auth', maxRequests: 2, duration: 3 },
      { label: '/api/kwnto/teams/', maxRequests: 10, duration: 60 },
      { label: '/api/', maxRequests: 300, duration: 10 },
    ],
  })
  expect(r.trustedProxy).toEqual({ headers: ['X-Forwarded-For'], useLeftmostIP: false })
  expect(r.backups).toEqual({ cron: '0 2 * * *', cronMaxKeep: 7 })
  expect((productionSettings({ ...ok, KWNTO_PUBLIC_URL: 'https://kwnto.example.ts.net/' }) as any).meta.appURL).toBe('https://kwnto.example.ts.net')
})

// Protects: two calls never share state a caller could mutate.
test('[C1] idempotence: calling twice returns equal, independent objects', () => {
  const a = productionSettings(ok) as any
  const b = productionSettings(ok) as any
  expect(a).toEqual(b)
  a.rateLimits.rules.pop()
  a.trustedProxy.headers.push('X-Real-IP')
  expect((productionSettings(ok) as any).rateLimits.rules).toHaveLength(3)
  expect((productionSettings(ok) as any).trustedProxy.headers).toEqual(['X-Forwarded-For'])
})
