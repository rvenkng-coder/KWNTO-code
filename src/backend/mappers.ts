import type { AuthUser, Team, TeamMember, Invite } from './types'

export function toAuthUser(record: Record<string, unknown>): AuthUser {
  return {
    id: record.id as string,
    email: record.email as string,
    name: (record.name as string) ?? '',
    verified: record.verified === true,
  }
}

export function toTeam(record: Record<string, unknown>, userId: string): Team {
  return {
    id: record.id as string,
    name: record.name as string,
    isOwner: record.owner === userId,
  }
}

export function toTeamMember(record: Record<string, unknown>): TeamMember {
  return {
    id: record.id as string,
    userId: record.user_id as string,
    name: (record.user_name as string) ?? '',
    role: (record.role as 'owner' | 'member') ?? 'member',
  }
}

export function toInvite(record: Record<string, unknown>): Invite {
  return {
    id: record.id as string,
    teamName: (record.team_name as string) ?? '',
    invitedByName: (record.invited_by_name as string) ?? '',
  }
}
