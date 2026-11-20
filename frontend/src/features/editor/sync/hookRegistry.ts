import type { SyncHooks } from './syncEngine'

// Several listeners (the editor store) hear what happens to the engine's entries through one set of hooks.

export function createHookRegistry(): { hooks: SyncHooks; register(hooks: SyncHooks): () => void } {
  const all = new Set<SyncHooks>()
  return {
    hooks: {
      saved: (entry, record) => all.forEach((h) => h.saved(entry, record)),
      refused: (entry, error) => all.forEach((h) => h.refused(entry, error)),
      theirs: (entry, server) => all.forEach((h) => h.theirs(entry, server)),
    },
    register(hooks) {
      all.add(hooks)
      return () => {
        all.delete(hooks)
      }
    },
  }
}
