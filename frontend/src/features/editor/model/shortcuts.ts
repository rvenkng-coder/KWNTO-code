export type ShortcutAction = 'undo' | 'redo' | 'copy' | 'cut' | 'paste' | 'delete' | 'search' | 'selectAll'

export interface KeyInput {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

export function shortcutFor(e: KeyInput, inTextField: boolean): ShortcutAction | null {
  if (e.altKey) return null

  const k = e.key.toLowerCase()
  const action = lookup(k, e.shiftKey, hasModifier(e))
  if (action) {
    if (inTextField) return action === 'search' ? action : null
    return action
  }
  if (!hasModifier(e) && !e.shiftKey && isDeleteKey(k)) {
    if (inTextField) return null
    return 'delete'
  }
  return null
}

function hasModifier(e: KeyInput): boolean {
  return e.ctrlKey || e.metaKey
}

function lookup(k: string, shift: boolean, mod: boolean): ShortcutAction | null {
  const prefix = mod ? 'm' : ''
  const suffix = shift ? 's' : ''
  const combo = prefix + suffix + k
  const map: Record<string, ShortcutAction> = { mz: 'undo', msz: 'redo', my: 'redo', mx: 'cut', mc: 'copy', mv: 'paste', mk: 'search', ma: 'selectAll' }
  return map[combo] ?? null
}

function isDeleteKey(k: string): boolean {
  return k === 'delete' || k === 'backspace'
}
