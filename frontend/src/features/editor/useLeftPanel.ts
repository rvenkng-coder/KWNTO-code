import { create } from 'zustand'

// Whether the left panel (Back to teams, project name) is shown (editor cards design, goal 3). The
// choice is kept in this browser only, under `kwnto.leftPanel` (F6); anything but `hidden` counts as
// shown, and storage that throws (private window, blocked site data) just means it is not kept.

const KEY = 'kwnto.leftPanel'

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'hidden'
  } catch {
    return true
  }
}

function write(shown: boolean): void {
  try {
    localStorage.setItem(KEY, shown ? 'shown' : 'hidden')
  } catch {
    // Not kept; the panel still toggles for this visit.
  }
}

interface LeftPanel { shown: boolean; toggle(): void }

export const useLeftPanel = create<LeftPanel>((set, get) => ({
  shown: read(),
  toggle: () => {
    const shown = !get().shown
    write(shown)
    set({ shown })
  },
}))
