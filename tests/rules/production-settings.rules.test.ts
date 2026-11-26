import { expect, test } from 'vitest'
import { adminSend } from './helpers/pb.ts'

// security.md 3: the production settings (rate limiter, trusted proxy, backup
// schedule) are written only when KWNTO_PRODUCTION=1. The test backend is not production, so
// none of them may be set, or the rules suite's parallel sign-ins would be refused. Not a
// collection, so no coverage entry. This passes before the migration exists: nothing is written
// yet, which is its point (it guards the flag, and fails if the flag is ever ignored).

type Settings = {
  rateLimits: { enabled: boolean }
  trustedProxy: { headers: string[] }
  backups: { cron: string }
}

// Protects the production flag: it is honoured, so dev and test backends never rate-limit or trust a proxy.
test('the test backend has no production settings', async () => {
  const res = await adminSend('/api/settings')
  expect(res.status).toBe(200)
  const settings = (await res.json()) as Settings
  expect(settings.rateLimits.enabled).toBe(false)
  expect(settings.trustedProxy.headers).toEqual([])
  expect(settings.backups.cron).toBe('')
})
