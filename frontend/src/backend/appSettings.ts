import type PocketBase from 'pocketbase'
import { toBackendError } from './errors'

export interface AppSettings {
  trashRetentionDays: number
  presenceTimeoutSeconds: number
}

/** The two admin settings the browser needs; `system_behavior` itself stays admin only (plan 7 D12). */
export function createAppSettings(pb: PocketBase) {
  return {
    async get(): Promise<AppSettings> {
      try {
        return await pb.send<AppSettings>('/api/kwnto/app-settings', { method: 'GET' })
      } catch (err) {
        throw toBackendError(err)
      }
    },
  }
}
