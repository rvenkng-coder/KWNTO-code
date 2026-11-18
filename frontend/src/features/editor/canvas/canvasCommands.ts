import { create } from 'zustand'

// What the canvas lets the rest of the editor ask of it. The left panel's button sits outside the
// canvas's React Flow provider, so the canvas registers the command here while it is shown.
interface CanvasCommands {
  /** Adds a node at the centre of the visible canvas; null while no chapter is open. */
  addNode: (() => void) | null
  setAddNode(fn: (() => void) | null): void
}

export const useCanvasCommands = create<CanvasCommands>((set) => ({
  addNode: null,
  setAddNode: (fn) => set({ addNode: fn }),
}))
