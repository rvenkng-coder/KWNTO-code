import type PocketBase from 'pocketbase'
import type { Team, TeamMember, TeamSettings, Invite } from './types'
import { toBackendError, createBackendError } from './errors'
import { toTeam, toTeamMember, toInvite } from './mappers'

export function createTeams(pb: PocketBase) {
  async function wrapped<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      throw toBackendError(err)
    }
  }

  return {
    async list(): Promise<Team[]> {
      return wrapped(async () => {
        const userId = pb.authStore.record?.id
        if (!userId) return []
        const members = await pb
          .collection('team_members')
          .getFullList({ filter: pb.filter('user = {:user}', { user: userId }), expand: 'team', perPage: 100 })
        return members
          .map((m) => ((m as Record<string, unknown>).expand as Record<string, unknown> | undefined)?.team as Record<string, unknown> | undefined)
          .filter((team): team is Record<string, unknown> => team !== undefined)
          .map((team) => toTeam(team, userId))
      })
    },

    async create(name: string): Promise<Team> {
      return wrapped(async () => {
        const userId = pb.authStore.record?.id
        if (!userId) throw toBackendError(new Error('Not signed in'))
        const user = await pb.collection('users').getOne(userId)
        if (!user.verified) throw createBackendError('forbidden', 'Verify your email to create or join a team.')
        const team = await pb.collection('teams').create({ name, owner: userId })
        return toTeam(team as Record<string, unknown>, userId)
      })
    },

    async remove(teamId: string): Promise<void> {
      return wrapped(async () => {
        await pb.collection('teams').delete(teamId)
      })
    },

    async members(teamId: string): Promise<TeamMember[]> {
      return wrapped(async () => {
        const rows = await pb
          .collection('team_members')
          .getFullList({ filter: pb.filter('team = {:team}', { team: teamId }), perPage: 100 })
        return rows.map(r => toTeamMember(r as Record<string, unknown>))
      })
    },

    async removeMember(memberId: string): Promise<void> {
      return wrapped(async () => {
        await pb.collection('team_members').delete(memberId)
      })
    },

    async settings(teamId: string): Promise<TeamSettings> {
      return wrapped(async () => {
        const settings = await pb
          .collection('team_settings')
          .getFirstListItem(pb.filter('team = {:team}', { team: teamId }))
        const plain = settings as Record<string, unknown>
        return {
          joinCode: plain.join_code as string,
          joinCodeEnabled: plain.join_code_enabled === true,
        }
      })
    },

    async setJoinCodeEnabled(teamId: string, enabled: boolean): Promise<void> {
      return wrapped(async () => {
        const settings = await pb
          .collection('team_settings')
          .getFirstListItem(pb.filter('team = {:team}', { team: teamId }))
        await pb.collection('team_settings').update(settings.id, { join_code_enabled: enabled })
      })
    },

    async regenerateJoinCode(teamId: string): Promise<string> {
      return wrapped(async () => {
        const resp = await pb.send<{ join_code: string }>(
          `/api/kwnto/teams/${encodeURIComponent(teamId)}/regenerate-code`,
          { method: 'POST' },
        )
        return resp.join_code
      })
    },

    async join(code: string): Promise<Team> {
      return wrapped(async () => {
        const resp = await pb.send<{ team: string; name: string }>(
          '/api/kwnto/teams/join',
          { method: 'POST', body: { code } },
        )
        const team = await pb.collection('teams').getOne(resp.team)
        return toTeam(team as Record<string, unknown>, pb.authStore.record?.id ?? '')
      })
    },

    async invite(teamId: string, email: string): Promise<void> {
      await wrapped(async () => {
        await pb.send(`/api/kwnto/teams/${encodeURIComponent(teamId)}/invites`, {
          method: 'POST',
          body: { email },
        })
      })
    },

    async invites(): Promise<Invite[]> {
      return wrapped(async () => {
        const rows = await pb
          .collection('team_invites')
          .getFullList({ filter: pb.filter("invited_user = {:user} && status = 'pending'", { user: pb.authStore.record?.id ?? '' }), perPage: 100 })
        return rows.map(r => toInvite(r as Record<string, unknown>))
      })
    },

    async acceptInvite(inviteId: string): Promise<Team> {
      return wrapped(async () => {
        const resp = await pb.send<{ team: string; name: string }>(
          `/api/kwnto/invites/${encodeURIComponent(inviteId)}/accept`,
          { method: 'POST' },
        )
        const team = await pb.collection('teams').getOne(resp.team)
        return toTeam(team as Record<string, unknown>, pb.authStore.record?.id ?? '')
      })
    },

    async declineInvite(inviteId: string): Promise<void> {
      await wrapped(async () => {
        await pb.send(`/api/kwnto/invites/${encodeURIComponent(inviteId)}/decline`, {
          method: 'POST',
        })
      })
    },
  }
}
