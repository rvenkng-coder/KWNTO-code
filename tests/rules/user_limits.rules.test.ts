import { expect, test } from 'vitest'
import { adminOnlyUserRowTests, onlyRowOf } from './helpers/user-rows.ts'
import { createUser } from './helpers/pb.ts'

// Protects design 7c (a user may change their theme but not their own quota or block
// status) and docs/security.md section 2 (deny by default). user_limits holds the
// admin's quota override for one user, so only the admin may read or change it.

adminOnlyUserRowTests('user_limits', { quota_override_bytes: 999_999_999_999 })

// Protects the ERD: an empty override means "use system_storage.default_quota_bytes",
// so a new user starts on the system default rather than on a quota of their own.
test('user_limits: a new user has no quota override', async () => {
  const row = await onlyRowOf('user_limits', (await createUser()).id)
  expect(row.quota_override_bytes).toBe(0)
})
