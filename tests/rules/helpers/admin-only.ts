import type PocketBase from 'pocketbase'
import { expect, test } from 'vitest'
import { asAdmin, asAnonymous, asUser, createUser } from './pb.ts'

// PocketBase answers a locked (null) rule with 403, and an unknown record with 404.
// Either one means the caller got nothing, which is what these checks protect.
export async function expectRefused(request: Promise<unknown>): Promise<void> {
  const error: unknown = await request.then(() => null, (e: unknown) => e)
  expect(error, 'the request was allowed').not.toBeNull()
  expect([403, 404]).toContain((error as { status?: number }).status)
}

// A list is refused either with 403 or by returning no rows; both hide every record.
export async function expectNoRows(pb: PocketBase, collection: string, filter?: string): Promise<void> {
  const result = await pb.collection(collection).getList(1, 10, filter ? { filter } : {}).catch((e: unknown) => e)
  if (result instanceof Error) {
    expect((result as { status?: number }).status).toBe(403)
    return
  }
  expect((result as { totalItems: number }).totalItems).toBe(0)
}

async function onlyRecordId(collection: string): Promise<string> {
  const records = await (await asAdmin()).collection(collection).getFullList()
  const first = records[0]
  if (!first) throw new Error(`${collection} has no record`)
  return first.id
}

// Registers the tests every admin-only collection needs: signed-out visitors and
// signed-in users can do nothing with it, and an injection string stays data.
// `change` is a real field edit, so an update that slipped through would be visible.
export function adminOnlyTests(collection: string, change: Record<string, unknown>): void {
  const callers: [string, () => Promise<PocketBase>][] = [
    ['a signed-out visitor', async () => asAnonymous()],
    ['a signed-in user', async () => asUser(await createUser())],
  ]

  for (const [who, connect] of callers) {
    test(`${collection}: ${who} cannot list, view, create, update or delete`, async () => {
      const id = await onlyRecordId(collection)
      const pb = await connect()
      await expectNoRows(pb, collection)
      await expectRefused(pb.collection(collection).getOne(id))
      await expectRefused(pb.collection(collection).create(change))
      await expectRefused(pb.collection(collection).update(id, change))
      await expectRefused(pb.collection(collection).delete(id))
    })
  }

  // Injection strings must be treated as data (docs/security.md section 5).
  test(`${collection}: an injection string in a filter returns nothing for a user`, async () => {
    const pb = await asUser(await createUser())
    await expectNoRows(pb, collection, pb.filter('id = {:n}', { n: `' OR 1=1 --` }))
  })
}

// Settings tables hold exactly one record; a second one would make "the" setting ambiguous.
export function singleRecordTest(collection: string): void {
  test(`${collection}: the admin sees exactly one record`, async () => {
    const records = await (await asAdmin()).collection(collection).getFullList()
    expect(records).toHaveLength(1)
  })
}

export async function readOnlyRecord(collection: string): Promise<Record<string, unknown>> {
  const records = await (await asAdmin()).collection(collection).getFullList()
  expect(records).toHaveLength(1)
  return records[0] as Record<string, unknown>
}
