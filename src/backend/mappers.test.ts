// Protects design 6.7: screens never see SDK types.
import { expect, test } from 'vitest'
import { toAuthUser, toTeam, toTeamMember, toInvite } from './mappers'

test('toAuthUser copies four fields, defaults name', () => {
  const record: Record<string, unknown> = { id: 'u1', email: 'a@b.com', name: 'Alice' }
  const result = toAuthUser(record)
  expect(result).toEqual({ id: 'u1', email: 'a@b.com', name: 'Alice', verified: false })
})

test('toAuthUser defaults name to empty string', () => {
  const record: Record<string, unknown> = { id: 'u1', email: 'a@b.com' }
  const result = toAuthUser(record)
  expect(result.name).toBe('')
})

test('toTeam sets isOwner when owner matches userId', () => {
  const record: Record<string, unknown> = { id: 't1', name: 'Crew', owner: 'o1' }
  expect(toTeam(record, 'o1').isOwner).toBe(true)
  expect(toTeam(record, 'x1').isOwner).toBe(false)
})

test('toTeamMember reads user_name copy', () => {
  const record: Record<string, unknown> = { id: 'm1', user_id: 'u1', user_name: 'Alice', role: 'member' }
  const result = toTeamMember(record)
  expect(result).toEqual({ id: 'm1', userId: 'u1', name: 'Alice', role: 'member' })
})

test('toInvite reads team_name and invited_by_name', () => {
  const record: Record<string, unknown> = { id: 'i1', team_name: 'Crew', invited_by_name: 'Boss' }
  const result = toInvite(record)
  expect(result).toEqual({ id: 'i1', teamName: 'Crew', invitedByName: 'Boss' })
})
