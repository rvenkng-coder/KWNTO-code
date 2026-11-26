import { create } from 'zustand'
import { closeTab, EMPTY_TABS, openTab, setTabWidth, type TabsView } from './tabsView'

// The tab view of this browser as a store, so other features (the search jump) can reopen a tab.
interface TabsViewStore {
  view: TabsView
  close(id: string): void
  open(id: string): void
  setWidth(id: string, width: number): void
  reset(): void
}

export const useTabsView = create<TabsViewStore>((set) => ({
  view: EMPTY_TABS,
  close: (id) => set((s) => ({ view: closeTab(s.view, id) })),
  open: (id) => set((s) => ({ view: openTab(s.view, id) })),
  setWidth: (id, width) => set((s) => ({ view: setTabWidth(s.view, id, width) })),
  reset: () => set({ view: EMPTY_TABS }),
}))
