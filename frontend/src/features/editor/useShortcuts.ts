import { useEffect } from 'react'
import { cutSelection, selectAll, trashSelection } from './canvas/selectionActions'
import { useSelection } from './canvas/useSelection'
import { shortcutFor, type ShortcutAction } from './model/shortcuts'
import { edits } from './store/edits'

// The editor's keyboard shortcuts (plan D12), on the window while a project is open. Inside a
// text field only Ctrl/⌘+K is taken; everything else stays with the browser (its own undo of typing).

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function run(action: ShortcutAction, chapterId: string | null): void {
  const nodeIds = useSelection.getState().nodeIds
  const actions: Record<ShortcutAction, () => void> = {
    undo: () => void edits.undo(),
    redo: () => void edits.redo(),
    copy: () => edits.copy(nodeIds),
    cut: () => void cutSelection(),
    paste: () => void (chapterId !== null && edits.paste(chapterId)),
    delete: () => void trashSelection(),
    // The search box of Task 13, when it is on the page.
    search: () => document.querySelector<HTMLElement>('[data-testid="search-input"]')?.focus(),
    selectAll: () => chapterId !== null && selectAll(chapterId),
  }
  actions[action]()
}

export function useShortcuts(chapterId: string | null): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const action = shortcutFor(e, isTextField(e.target))
      if (action === null) return
      e.preventDefault()
      run(action, chapterId)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [chapterId])
}
