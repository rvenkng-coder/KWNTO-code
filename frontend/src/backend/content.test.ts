import { ClientResponseError } from 'pocketbase'
import type PocketBase from 'pocketbase'
import { expect, test } from 'vitest'
import { createContent } from './content'

const failing = (status: number, response: object) => ({
  collection: () => ({ getOne: () => Promise.reject(new ClientResponseError({ status, response })) }),
}) as unknown as PocketBase

// Protects: design 6.7: `get` answers null for a record that does not exist (PocketBase's 404 carries a message), but a bare 404 from a proxy with no route is "cannot be reached", not "gone".
test('get answers null for a real 404 and rejects for a proxy 404', async () => {
  expect(await createContent(failing(404, { message: "The requested resource wasn't found." })).get('nodes', 'x')).toBeNull()
  await expect(createContent(failing(404, {})).get('nodes', 'x')).rejects.toMatchObject({ kind: 'unreachable' })
})
