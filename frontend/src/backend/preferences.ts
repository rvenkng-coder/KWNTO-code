import type PocketBase from 'pocketbase'
import type { Preferences } from './types'
import { toBackendError } from './errors'

function toPreferences(record: Record<string, unknown>): Preferences {
  return {
    theme: record.theme === 'light' ? 'light' : 'dark',
    minimapVisible: record.minimap_visible !== false,
  }
}

/** The signed-in user's own `user_preferences` row (one per user, made by a hook). */
export function createPreferences(pb: PocketBase) {
  async function row(): Promise<Record<string, unknown>> {
    const userId = pb.authStore.record?.id ?? ''
    return pb
      .collection('user_preferences')
      .getFirstListItem(pb.filter('user = {:user}', { user: userId }))
  }

  return {
    async get(): Promise<Preferences> {
      try {
        return toPreferences(await row())
      } catch (err) {
        throw toBackendError(err)
      }
    },

    /** Sends only the keys given, so one tab never overwrites another tab's other choice. */
    async set(changes: Partial<Preferences>): Promise<Preferences> {
      const body: Record<string, unknown> = {}
      if (changes.theme !== undefined) body.theme = changes.theme
      if (changes.minimapVisible !== undefined) body.minimap_visible = changes.minimapVisible
      try {
        const current = await row()
        return toPreferences(await pb.collection('user_preferences').update(current.id as string, body))
      } catch (err) {
        throw toBackendError(err)
      }
    },
  }
}
