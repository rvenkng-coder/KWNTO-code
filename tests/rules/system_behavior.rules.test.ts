import { expect, test } from 'vitest'
import { adminOnlyTests, readOnlyRecord, singleRecordTest } from './helpers/admin-only.ts'

// Protects design 7c and docs/security.md section 2: system settings are admin only,
// there is exactly one record, and its defaults are the ones the spec names.
adminOnlyTests('system_behavior', { max_failed_logins: 1000 })
singleRecordTest('system_behavior')

// Defaults from the ERD and the plan's Global Constraints (decision D3 adds
// team_attempts_per_hour). A user able to raise max_failed_logins could brute-force.
test('system_behavior starts with the spec defaults', async () => {
  const record = await readOnlyRecord('system_behavior')
  expect(record.presence_timeout_seconds).toBe(30)
  expect(record.analytics_retention_days).toBe(365)
  expect(record.trash_retention_days).toBe(30)
  expect(record.security_retention_days).toBe(365)
  expect(record.max_failed_logins).toBe(3)
  expect(record.lockout_minutes).toBe(5)
  expect(record.team_attempts_per_hour).toBe(20)
})
