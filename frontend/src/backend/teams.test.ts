// Protects design 6.7: join, acceptInvite, regenerateJoinCode map SDK errors to BackendError.
import { expect, test, vi } from 'vitest'
import type PocketBase from 'pocketbase'
import { ClientResponseError } from 'pocketbase'
import { createTeams } from './teams'

function makeFakePb(): PocketBase {
  return {
    authStore: { record: { id: 'user1' } } as PocketBase['authStore'],
    collection: vi.fn(() => ({
      getOne: vi.fn(),
      getFullList: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      authWithPassword: vi.fn(),
      authRefresh: vi.fn(),
      requestVerification: vi.fn(),
      requestPasswordReset: vi.fn(),
      health: { check: vi.fn() },
    })) as unknown as PocketBase['collection'],
    send: vi.fn() as unknown as PocketBase['send'],
    filter: vi.fn((f: string) => f) as unknown as PocketBase['filter'],
  } as PocketBase
}

test('join maps 404 to not-found', async () => {
  const pb = makeFakePb()
  ;(pb.send as ReturnType<typeof vi.fn>).mockRejectedValue(new ClientResponseError({ status: 404, response: {} }))
  const teams = createTeams(pb)
  const err = await teams.join('code').catch((e) => e)
  expect(err.kind).toBe('not-found')
})

test('acceptInvite maps 404 to not-found', async () => {
  const pb = makeFakePb()
  ;(pb.send as ReturnType<typeof vi.fn>).mockRejectedValue(new ClientResponseError({ status: 404, response: {} }))
  const teams = createTeams(pb)
  const err = await teams.acceptInvite('inv1').catch((e) => e)
  expect(err.kind).toBe('not-found')
})

test('regenerateJoinCode maps 404 to not-found', async () => {
  const pb = makeFakePb()
  ;(pb.send as ReturnType<typeof vi.fn>).mockRejectedValue(new ClientResponseError({ status: 404, response: {} }))
  const teams = createTeams(pb)
  const err = await teams.regenerateJoinCode('team1').catch((e) => e)
  expect(err.kind).toBe('not-found')
})
