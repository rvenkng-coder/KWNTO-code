import { create } from 'zustand'
import { backend } from '../../backend'
import type { AuthUser } from '../../backend/types'
import { errorMessage } from '../errorMessage'

interface SessionState {
  user: AuthUser | null
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signOut: () => void
  refresh: () => Promise<void>
}

export const useSession = create<SessionState>((set) => {
  const user = backend.auth.current()
  set({ user, error: null })

  backend.auth.onChange((u) => {
    set({ user: u, error: null })
  })

  return {
    user,
    error: null,
    async signIn(email: string, password: string) {
      try {
        const user = await backend.auth.signIn(email, password)
        set({ user, error: null })
      } catch (err: unknown) {
        set({ error: errorMessage(err, 'Sign in failed') })
      }
    },
    async signUp(email: string, password: string, name: string) {
      try {
        await backend.auth.signUp(email, password, name)
        set({ error: null })
      } catch (err: unknown) {
        set({ error: errorMessage(err, 'Sign up failed') })
      }
    },
    signOut() {
      backend.auth.signOut()
      set({ user: null, error: null })
    },
    async refresh() {
      try {
        const user = await backend.auth.refresh()
        set({ user, error: null })
      } catch {
        set({ user: null, error: null })
      }
    },
  }
})
