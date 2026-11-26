import { create } from 'zustand'
import { backend } from '../../backend'
import type { Team } from '../../backend/types'
import { errorMessage } from '../errorMessage'

interface TeamState {
  teams: Team[]
  error: string | null
  notice: string | null
  list: () => Promise<void>
  create: (name: string) => Promise<boolean>
  remove: (teamId: string) => Promise<void>
  join: (code: string) => Promise<boolean>
}

export const useTeams = create<TeamState>((set, get) => ({
  teams: [],
  error: null,
  notice: null,
  list: async () => {
    try {
      const teams = await backend.teams.list()
      // Leave `error` alone: a list that lands late must not wipe an action's error.
      // Each action clears it when it starts.
      set({ teams })
    } catch (err: unknown) {
      set({ error: errorMessage(err, 'Failed to load teams') })
    }
  },
  create: async (name: string) => {
    try {
      set({ notice: null, error: null })
      await backend.teams.create(name)
      await get().list()
      return true
    } catch (err: unknown) {
      set({ error: errorMessage(err, 'Failed to create team') })
      return false
    }
  },
  remove: async (teamId: string) => {
    try {
      set({ notice: null, error: null })
      await backend.teams.remove(teamId)
      await get().list()
    } catch (err: unknown) {
      set({ error: errorMessage(err, 'Failed to remove team') })
    }
  },
  join: async (code: string) => {
    try {
      set({ notice: null, error: null })
      const joined = await backend.teams.join(code)
      await get().list()
      set({ notice: `Joined ${joined.name}.` })
      return true
    } catch (err: unknown) {
      set({ error: errorMessage(err, 'Failed to join team') })
      return false
    }
  },
}))
