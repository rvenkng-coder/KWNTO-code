import { create } from 'zustand'

// A request to select a node and centre the canvas on it (search and cross-chapter tags, plan Task 13). The
// nonce makes a second request for the same node a new request. The canvas of the node's
// chapter takes the request once its nodes are measured, then clears it.

export interface CanvasFocus {
  request: { nodeId: string; nonce: number } | null
  focus(nodeId: string): void
  done(): void
}

let nonce = 0

export const useCanvasFocus = create<CanvasFocus>((set) => ({
  request: null,
  focus: (nodeId) => set({ request: { nodeId, nonce: ++nonce } }),
  done: () => set({ request: null }),
}))
