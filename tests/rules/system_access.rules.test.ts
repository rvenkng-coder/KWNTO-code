import { expect, test } from 'vitest'
import { adminOnlyTests, readOnlyRecord, singleRecordTest } from './helpers/admin-only.ts'

// Protects design 7c and docs/security.md section 2: system settings are admin only,
// there is exactly one record, and its defaults are the ones the spec names.
adminOnlyTests('system_access', { registration_open: false })
singleRecordTest('system_access')

// Defaults from design 7c: sign-up open, no lockdown, no lockdown message.
test('system_access starts with the spec defaults', async () => {
  const record = await readOnlyRecord('system_access')
  expect(record.registration_open).toBe(true)
  expect(record.lockdown).toBe(false)
  expect(record.lockdown_message).toBe('')
})
