import { ClientResponseError } from 'pocketbase'
import type PocketBase from 'pocketbase'
import type { AuthUser } from './types'
import { toAuthUser } from './mappers'
import { toBackendError } from './errors'

export function createAuth(pb: PocketBase) {
  const listeners = new Set<(user: AuthUser | null) => void>()
  let cached: AuthUser | null = null
  // Bumped by every sign-out, so a refresh that was already in flight cannot sign the
  // user back in when its answer arrives (the SDK stores the answer by itself).
  let signOutCount = 0

  function current(): AuthUser | null {
    const rec = pb.authStore.record
    if (!rec) { cached = null; return null }
    if (!cached || cached.id !== rec.id) cached = toAuthUser(rec as Record<string, unknown>)
    return cached
  }

  // Feed every listener on store change (signIn, refresh, signOut, another tab).
  pb.authStore.onChange((_token, record) => {
    if (!record) { cached = null; for (const fn of listeners) { try { fn(null) } catch { /* listener threw */ } } }
    else { cached = toAuthUser(record as Record<string, unknown>); for (const fn of listeners) { try { fn(cached) } catch { /* listener threw */ } } }
  })

  function throwIfBackend(err: unknown): never {
    throw toBackendError(err)
  }

  return {
    async signUp(email: string, password: string, name: string): Promise<void> {
      try { await pb.collection('users').create({ email, password, passwordConfirm: password, name }) } catch (err) { throwIfBackend(err) }
    },

    async signIn(email: string, password: string): Promise<AuthUser> {
      try { const auth = await pb.collection('users').authWithPassword(email, password); cached = toAuthUser(auth.record as Record<string, unknown>); return cached } catch (err) { throwIfBackend(err) }
    },

    signOut(): void {
      signOutCount += 1; pb.authStore.clear()
    },

    current,

    async refresh(): Promise<AuthUser | null> {
      if (!pb.authStore.token) return null
      const startedAt = signOutCount
      try {
        const auth = await pb.collection('users').authRefresh()
        if (signOutCount !== startedAt) { pb.authStore.clear(); return null }
        cached = toAuthUser(auth.record as Record<string, unknown>)
        return cached
      } catch (err) {
        const refused = err instanceof ClientResponseError && [401, 403, 404].includes(err.status)
        if (!refused) return current()
        pb.authStore.clear(); return null
      }
    },

    async requestVerification(email: string): Promise<void> { try { await pb.collection('users').requestVerification(email) } catch (err) { throwIfBackend(err) } },

    async requestPasswordReset(email: string): Promise<void> { try { await pb.collection('users').requestPasswordReset(email) } catch (err) { throwIfBackend(err) } },

    onChange(listener: (user: AuthUser | null) => void): () => void {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}
