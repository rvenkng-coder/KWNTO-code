import { ClientResponseError } from 'pocketbase'
import type PocketBase from 'pocketbase'
import type { AuthUser } from './types'
import { toAuthUser } from './mappers'
import { toBackendError } from './errors'

function notifyAll(
  listeners: Set<(user: AuthUser | null) => void>,
  user: AuthUser | null,
): void {
  for (const fn of listeners) {
    try {
      fn(user)
    } catch {
      // listener threw
    }
  }
}

function resolveCurrent(
  pb: PocketBase,
  cached: { value: AuthUser | null },
): AuthUser | null {
  const rec = pb.authStore.record
  if (!rec) {
    cached.value = null
    return null
  }
  if (!cached.value || cached.value.id !== rec.id) {
    cached.value = toAuthUser(rec as Record<string, unknown>)
  }
  return cached.value
}

async function signUp(
  pb: PocketBase,
  email: string,
  password: string,
  name: string,
): Promise<void> {
  try {
    await pb.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      name,
    })
  } catch (err) {
    throw toBackendError(err)
  }
}

async function requestVerification(
  pb: PocketBase,
  email: string,
): Promise<void> {
  try {
    await pb.collection('users').requestVerification(email)
  } catch (err) {
    throw toBackendError(err)
  }
}

async function requestPasswordReset(
  pb: PocketBase,
  email: string,
): Promise<void> {
  try {
    await pb.collection('users').requestPasswordReset(email)
  } catch (err) {
    throw toBackendError(err)
  }
}

async function confirmVerification(pb: PocketBase, token: string): Promise<void> {
  try {
    await pb.collection('users').confirmVerification(token)
  } catch (err) {
    throw toBackendError(err)
  }
}

async function confirmPasswordReset(
  pb: PocketBase,
  token: string,
  password: string,
  passwordConfirm: string,
): Promise<void> {
  try {
    await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm)
  } catch (err) {
    throw toBackendError(err)
  }
}

async function doSignIn(
  pb: PocketBase,
  cached: { value: AuthUser | null },
  email: string,
  password: string,
): Promise<AuthUser> {
  try {
    const auth = await pb.collection('users').authWithPassword(
      email,
      password,
    )
    cached.value = toAuthUser(auth.record as Record<string, unknown>)
    return cached.value
  } catch (err) {
    throw toBackendError(err)
  }
}

async function doRefresh(
  pb: PocketBase,
  cached: { value: AuthUser | null },
  getSignOutCount: () => number,
  currentFn: () => AuthUser | null,
): Promise<AuthUser | null> {
  if (!pb.authStore.token) return null
  const startedAt = getSignOutCount()
  try {
    const auth = await pb.collection('users').authRefresh()
    if (getSignOutCount() !== startedAt) {
      pb.authStore.clear()
      return null
    }
    cached.value = toAuthUser(auth.record as Record<string, unknown>)
    return cached.value
  } catch (err) {
    // Only a refusal ends the session. An unreachable server (status 0) or a
    // server error must not sign everyone out: keep the session we have.
    const refused =
      err instanceof ClientResponseError &&
      [401, 403, 404].includes(err.status)
    if (!refused) return currentFn()
    pb.authStore.clear()
    return null
  }
}

export function createAuth(pb: PocketBase) {
  const listeners = new Set<(user: AuthUser | null) => void>()
  // Bumped by every sign-out, so a refresh that was already in flight cannot sign the
  // user back in when its answer arrives (the SDK stores the answer by itself).
  let signOutCount = 0
  const cache = { value: null as AuthUser | null }

  pb.authStore.onChange((_token, record) => {
    if (!record) {
      cache.value = null
      notifyAll(listeners, null)
    } else {
      cache.value = toAuthUser(record as Record<string, unknown>)
      notifyAll(listeners, cache.value)
    }
  })

  const currentRef = (): AuthUser | null =>
    resolveCurrent(pb, cache)

  return {
    async signUp(email: string, password: string, name: string): Promise<void> {
      await signUp(pb, email, password, name)
    },

    async signIn(
      email: string,
      password: string,
    ): Promise<AuthUser> {
      return doSignIn(pb, cache, email, password)
    },

    signOut(): void {
      signOutCount += 1
      // clear() triggers the store's onChange above, which resets `cache` and tells every listener once.
      pb.authStore.clear()
    },

    current: currentRef,

    async refresh(): Promise<AuthUser | null> {
      return doRefresh(pb, cache, () => signOutCount, currentRef)
    },

    async requestVerification(email: string): Promise<void> {
      await requestVerification(pb, email)
    },

    async requestPasswordReset(email: string): Promise<void> {
      await requestPasswordReset(pb, email)
    },

    async confirmVerification(token: string): Promise<void> {
      await confirmVerification(pb, token)
    },

    async confirmPasswordReset(token: string, password: string, passwordConfirm: string): Promise<void> {
      await confirmPasswordReset(pb, token, password, passwordConfirm)
    },

    onChange(
      listener: (user: AuthUser | null) => void,
    ): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
