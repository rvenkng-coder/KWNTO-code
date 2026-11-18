import { create } from 'zustand'

// Link mode (editor cards design, goal 1): after Link or Re-link on a choice in the panel, the
// next node clicked on the canvas becomes its target. It ends after a link, with Escape, with a
// click on empty canvas, or when the chapter changes.

export const LINK_BANNER = 'Select a target node'

interface LinkMode {
  choiceId: string | null
  start(choiceId: string): void
  stop(): void
}

export const useLinkMode = create<LinkMode>((set) => ({
  choiceId: null,
  start: (choiceId) => set({ choiceId }),
  stop: () => set({ choiceId: null }),
}))
