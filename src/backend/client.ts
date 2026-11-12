import PocketBase from 'pocketbase'

export interface Backend { health(): Promise<boolean> }

export function createBackend(baseUrl?: string): Backend {
  const pb = new PocketBase(baseUrl ?? '/')
  return {
    async health(): Promise<boolean> {
      try {
        await pb.health.check()
        return true
      } catch {
        return false
      }
    },
  }
}
