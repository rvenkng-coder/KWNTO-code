import { expect, test } from 'vitest'
import { adminOnlyUserRowTests, onlyRowOf, rowsOf } from './helpers/user-rows.ts'
import { asAdmin, createUser } from './helpers/pb.ts'

// Protects design 7c (a user may change their theme but not their own quota or block
// status) and docs/security.md section 2 (deny by default). user_status holds whether
// the admin has blocked an account, so a blocked user must not be able to unblock themselves.

adminOnlyUserRowTests('user_status', { blocked: true, blocked_reason: 'changed by a client', blocked_at: '2026-01-01 00:00:00.000Z' })

// Protects design 7c: a new account starts unblocked.
test('user_status: a new user is not blocked', async () => {
  const row = await onlyRowOf('user_status', (await createUser()).id)
  expect(row.blocked).toBe(false)
  expect(row.blocked_reason).toBe('')
  expect(row.blocked_at).toBe('')
})

// Protects the ERD: the per-user rows belong to the account and go with it (cascade
// delete), so no orphan row is left behind and no stale block applies to a reused id.
test('user_status: deleting a user deletes their three per-user rows', async () => {
  const someone = await createUser()
  for (const collection of ['user_preferences', 'user_limits', 'user_status']) {
    await onlyRowOf(collection, someone.id)
  }

  await (await asAdmin()).collection('users').delete(someone.id)

  for (const collection of ['user_preferences', 'user_limits', 'user_status']) {
    expect(await rowsOf(collection, someone.id), collection).toEqual([])
  }
})
