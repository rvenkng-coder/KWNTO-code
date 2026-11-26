import { expect, test } from 'vitest'
import { expectNoRows, expectRefused } from './helpers/admin-only.ts'
import { onlyRowOf } from './helpers/user-rows.ts'
import { asAnonymous, asUser, createUser } from './helpers/pb.ts'

// Protects design 7c (a user may change their theme but not their own quota or block
// status) and docs/security.md section 2 (deny by default). user_preferences is the one
// per-user table its user may edit, and only their own row, and only its settings.

test('user_preferences: a new user has exactly one row, readable by them, with the defaults', async () => {
  const someone = await createUser()
  const rows = await (await asUser(someone)).collection('user_preferences').getFullList()
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ user: someone.id, theme: 'dark', minimap_visible: true })
})

test("user_preferences: a user cannot list, view or update another user's row", async () => {
  const [a, b] = [await createUser(), await createUser()]
  const rowOfA = await onlyRowOf('user_preferences', a.id)
  const rowOfB = await onlyRowOf('user_preferences', b.id)
  const pb = await asUser(a)

  const listed = await pb.collection('user_preferences').getFullList()
  expect(listed.map((row) => row.id)).toEqual([rowOfA.id])
  await expect(pb.collection('user_preferences').getOne(rowOfB.id)).rejects.toMatchObject({ status: 404 })
  await expectRefused(pb.collection('user_preferences').update(rowOfB.id, { theme: 'light' }))
  expect((await onlyRowOf('user_preferences', b.id)).theme).toBe('dark')
})

test('user_preferences: a user can change their own theme and minimap setting', async () => {
  const someone = await createUser()
  const row = await onlyRowOf('user_preferences', someone.id)
  const pb = await asUser(someone)

  const updated = await pb.collection('user_preferences').update(row.id, { theme: 'light', minimap_visible: false })
  expect(updated).toMatchObject({ theme: 'light', minimap_visible: false })
})

// Protects the typed settings rule (ERD): a value outside light|dark is refused, not stored.
test('user_preferences: a theme other than light or dark is rejected', async () => {
  const someone = await createUser()
  const row = await onlyRowOf('user_preferences', someone.id)
  const pb = await asUser(someone)

  await expect(pb.collection('user_preferences').update(row.id, { theme: 'neon' })).rejects.toMatchObject({
    status: 400,
  })
  expect((await onlyRowOf('user_preferences', someone.id)).theme).toBe('dark')
})

// Protects against moving a row onto another account: that would give B two rows, or
// let A choose B's theme. The user field is set by the server only.
test('user_preferences: a user cannot change which account their row belongs to', async () => {
  const [a, b] = [await createUser(), await createUser()]
  const row = await onlyRowOf('user_preferences', a.id)
  const pb = await asUser(a)

  await expectRefused(pb.collection('user_preferences').update(row.id, { user: b.id }))
  expect((await onlyRowOf('user_preferences', a.id)).id).toBe(row.id)
  expect((await onlyRowOf('user_preferences', b.id)).id).not.toBe(row.id)
})

// Rows are made by the server, one per user; a client creating or deleting them would
// break the one-row-per-user rule the app relies on.
test('user_preferences: a user cannot create or delete a row', async () => {
  const someone = await createUser()
  const row = await onlyRowOf('user_preferences', someone.id)
  const pb = await asUser(someone)

  await expectRefused(
    pb.collection('user_preferences').create({ user: someone.id, theme: 'light', minimap_visible: true }),
  )
  await expectRefused(pb.collection('user_preferences').delete(row.id))
  expect((await onlyRowOf('user_preferences', someone.id)).id).toBe(row.id)
})

test('user_preferences: a signed-out visitor gets nothing', async () => {
  const someone = await createUser()
  const row = await onlyRowOf('user_preferences', someone.id)
  const pb = asAnonymous()

  await expectNoRows(pb, 'user_preferences')
  await expectRefused(pb.collection('user_preferences').getOne(row.id))
  await expectRefused(pb.collection('user_preferences').create({ user: someone.id, theme: 'light' }))
  await expectRefused(pb.collection('user_preferences').update(row.id, { theme: 'light' }))
  await expectRefused(pb.collection('user_preferences').delete(row.id))
  expect((await onlyRowOf('user_preferences', someone.id)).theme).toBe('dark')
})

// Injection strings must be treated as data (docs/security.md section 5).
test('user_preferences: an injection string in a filter returns nothing', async () => {
  const pb = await asUser(await createUser())
  await expectNoRows(pb, 'user_preferences', pb.filter('id = {:n}', { n: `' OR 1=1 --` }))
})
