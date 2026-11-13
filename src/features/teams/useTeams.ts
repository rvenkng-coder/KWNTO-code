import { create } from 'zustand'
import { backend } from '../../backend'
import type { Team } from '../../backend/types'
import { errorMessage } from '../errorMessage'

interface TeamState {
  teams: Team[]
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
      set({ error: errorMessage(err, 'Failed to load teams') })
    }
  },
  create: async (name: string) => {
    try {
      await backend.teams.create(name)
      await useTeams.getState().list()
    } catch (err: unknown) {
      set({ error: errorMessage(err, 'Failed to create team') })
    }
  },
  remove: async (teamId: string) => {
    try {
      await backend.teams.remove(teamId)
      await useTeams.getState().list()
    } catch (err: unknown) {
      set({ error: errorMessage(err, 'Failed to remove team') })
    }
  },
  join: async (code: string) => {
    try {
      await backend.teams.join(code)
      await useTeams.getState().list()
    } catch (err: unknown) {
      set({ error: errorMessage(err, 'Failed to join team') })
    }
  },
}))
