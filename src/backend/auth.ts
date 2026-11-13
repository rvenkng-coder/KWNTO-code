import { ClientResponseError } from 'pocketbase'
import type PocketBase from 'pocketbase'
import type { AuthUser } from './types'
import { toAuthUser } from './mappers'
import { toBackendError } from './errors'

export function createAuth(pb: PocketBase) {
  let listener: ((user: AuthUser | null) => void) | null = null
  let cached: AuthUser | null = null

  function current(): AuthUser | null {
    const rec = pb.authStore.record
    if (!rec) {
      cached = null
      return null
    }
    if (!cached || cached.id !== rec.id) {
      cached = toAuthUser(rec as Record<string, unknown>)
    }
    return cached
  }

  pb.authStore.onChange((_token, record) => {
    if (!record) {
      cached = null
      listener?.(null)
    } else {
      cached = toAuthUser(record as Record<string, unknown>)
    }
  })

  return {
    async signUp(email: string, password: string, name: string): Promise<void> {
      try {
        await pb.collection('users').create({ email, password, passwordConfirm: password, name })
      } catch (err) {
        throw toBackendError(err)
      }
    },

    async signIn(email: string, password: string): Promise<AuthUser> {
      try {
        const auth = await pb.collection('users').authWithPassword(email, password)
        cached = toAuthUser(auth.record as Record<string, unknown>)
        listener?.(cached)
        return cached
      } catch (err) {
        throw toBackendError(err)
      }
    },

    signOut(): void {
      // clear() triggers the store's onChange above, which resets `cached` and tells the listener once.
      pb.authStore.clear()
    },

    current,

    async refresh(): Promise<AuthUser | null> {
      if (!pb.authStore.token) return null
      try {
        const auth = await pb.collection('users').authRefresh()
        cached = toAuthUser(auth.record as Record<string, unknown>)
        listener?.(cached)
        return cached
      } catch (err) {
        // Only a refusal ends the session. An unreachable server (status 0) or a
        // server error must not sign everyone out: keep the session we have.
        const refused = err instanceof ClientResponseError && [401, 403, 404].includes(err.status)
        if (!refused) return current()
        pb.authStore.clear() // the store's onChange resets `cached` and tells the listener
        return null
      }
    },

    async requestVerification(email: string): Promise<void> {
      try {
        await pb.collection('users').requestVerification(email)
      } catch (err) {
        throw toBackendError(err)
      }
    },

    async requestPasswordReset(email: string): Promise<void> {
      try {
        await pb.collection('users').requestPasswordReset(email)
      } catch (err) {
        throw toBackendError(err)
      }
    },

    onChange(listenerFn: (user: AuthUser | null) => void): () => void {
      listener = listenerFn
      return () => { listener = null }
    },
  }
}
