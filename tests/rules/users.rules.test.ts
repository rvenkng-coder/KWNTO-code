import { expect, test } from 'vitest'
import { asAnonymous, asUser, createUser } from './helpers/pb.ts'

// Protects docs/security.md section 1.3: emails and accounts are private to everyone but the admin.
test('signed-out visitors cannot list users', async () => {
  await createUser()
  expect((await asAnonymous().collection('users').getList(1, 10)).totalItems).toBe(0)
})

test('a user cannot view another user or see their email', async () => {
  const [a, b] = [await createUser(), await createUser()]
  const pb = await asUser(a)
  await expect(pb.collection('users').getOne(b.id)).rejects.toMatchObject({ status: 404 })
  const listed = await pb.collection('users').getFullList()
  expect(listed.map((u) => u.id)).toEqual([a.id])
  expect(JSON.stringify(listed)).not.toContain(b.email)
})

// Injection strings must be treated as data (docs/security.md section 5).
test('an injection string in a filter returns nothing and does not error out the server', async () => {
  const pb = await asUser(await createUser())
  const result = await pb.collection('users').getList(1, 10, { filter: pb.filter('name = {:n}', { n: `' OR 1=1 --` }) })
  expect(result.totalItems).toBe(0)
})
