import { create } from 'zustand'

// What is selected on the canvas: nodes, or one connection. The panel, the shortcuts and search
// read and set it; the canvas follows it.

export interface Selection {
  nodeIds: string[]
  connectionId: string | null
  set(nodeIds: string[], connectionId: string | null): void
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i])

export const useSelection = create<Selection>((set, get) => ({
  nodeIds: [],
  connectionId: null,
  set(nodeIds, connectionId) {
    // An unchanged selection sets nothing, so the canvas and this store cannot echo each other forever.
    const s = get()
    if (same(s.nodeIds, nodeIds) && s.connectionId === connectionId) return
    set({ nodeIds, connectionId })
  },
}))
