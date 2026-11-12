import { create } from 'zustand'
import { backend } from '../../backend'

interface TeamState {
  teams: { id: string; name: string; isOwner: boolean }[]
  error: string | null
  list: () => Promise<void>
  create: (name: string) => Promise<void>
  remove: (teamId: string) => Promise<void>
  join: (code: string) => Promise<void>
}

export const useTeams = create<TeamState>((set) => ({
  teams: [],
  error: null,
  list: async () => {
    try {
      const teams = await backend.teams.list()
      set({ teams, error: null })
    } catch (err: unknown) {
      const e = err as { kind?: string; message?: string }
      set({ error: e.message ?? 'Failed to load teams' })
    }
  },
  create: async (name: string) => {
    try {
      await backend.teams.create(name)
      await useTeams.getState().list()
    } catch (err: unknown) {
      const e = err as { kind?: string; message?: string }
      set({ error: e.message ?? 'Failed to create team' })
    }
  },
  remove: async (teamId: string) => {
    try {
      await backend.teams.remove(teamId)
      await useTeams.getState().list()
    } catch (err: unknown) {
      const e = err as { kind?: string; message?: string }
      set({ error: e.message ?? 'Failed to remove team' })
    }
  },
  join: async (code: string) => {
    try {
      await backend.teams.join(code)
      await useTeams.getState().list()
    } catch (err: unknown) {
      const e = err as { kind?: string; message?: string }
      set({ error: e.message ?? 'Failed to join team' })
    }
  },
}))
