import { expect, test } from 'vitest'
import { adminOnlyTests, expectNoRows, expectRefused } from './admin-only.ts'
import { asAdmin, asUser, createUser, type TestUser } from './pb.ts'

// The rows of one user in a per-user table, read as the admin (who bypasses every rule).
export async function rowsOf(collection: string, userId: string): Promise<Record<string, unknown>[]> {
  const admin = await asAdmin()
  return admin.collection(collection).getFullList({ filter: admin.filter('user = {:id}', { id: userId }) })
}

// The single row a new user gets in a per-user table.
export async function onlyRowOf(collection: string, userId: string): Promise<Record<string, unknown> & { id: string }> {
  const rows = await rowsOf(collection, userId)
  expect(rows, `${collection} rows of user ${userId}`).toHaveLength(1)
  return rows[0] as Record<string, unknown> & { id: string }
}

// Registers the tests every admin-only per-user table needs (user_limits, user_status):
// every new user gets exactly one row; the user it describes, another user and a
// signed-out visitor can do nothing with it; an injection string stays data.
// `change` is a real field edit, so an update that slipped through would be visible.
export function adminOnlyUserRowTests(collection: string, change: Record<string, unknown>): void {
  test(`${collection}: a new user gets exactly one row, visible to the admin`, async () => {
    const someone = await createUser()
    const row = await onlyRowOf(collection, someone.id)
    expect(row.user).toBe(someone.id)
  })

  test(`${collection}: the user it describes cannot list, view, create, update or delete it`, async () => {
    const owner: TestUser = await createUser()
    const before = await onlyRowOf(collection, owner.id)
    const pb = await asUser(owner)

    await expectNoRows(pb, collection)
    await expectRefused(pb.collection(collection).getOne(before.id))
    await expectRefused(pb.collection(collection).create({ ...change, user: owner.id }))
    await expectRefused(pb.collection(collection).update(before.id, change))
    await expectRefused(pb.collection(collection).delete(before.id))

    // Nothing changed behind the refusals: still one row, with the same values.
    expect(await onlyRowOf(collection, owner.id)).toEqual(before)
  })

  // Signed-out visitors and other users, aimed at a real user's row, plus the injection check.
  adminOnlyTests(collection, change, async () => (await onlyRowOf(collection, (await createUser()).id)).id)
}
