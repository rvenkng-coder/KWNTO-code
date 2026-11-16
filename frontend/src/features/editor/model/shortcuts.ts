export type ShortcutAction = 'undo' | 'redo' | 'copy' | 'paste' | 'delete' | 'search' | 'selectAll'

export interface KeyInput {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

export function shortcutFor(e: KeyInput, inTextField: boolean): ShortcutAction | null {
  if (inTextField) return e.key.toLowerCase() === 'k' && hasModifier(e) ? 'search' : null
  if (e.altKey) return null

  const k = e.key.toLowerCase()
  const action = lookup(k, e.shiftKey, hasModifier(e))
  if (action) return action
  if (!hasModifier(e) && !e.shiftKey && isDeleteKey(k)) return 'delete'
  return null
}

function hasModifier(e: KeyInput): boolean {
  return e.ctrlKey || e.metaKey
}

function lookup(k: string, shift: boolean, mod: boolean): ShortcutAction | null {
  const prefix = mod ? 'm' : ''
  const suffix = shift ? 's' : ''
  const combo = prefix + suffix + k
  const map: Record<string, ShortcutAction> = { mz: 'undo', msz: 'redo', my: 'redo', mc: 'copy', mv: 'paste', mk: 'search', ma: 'selectAll' }
  return map[combo] ?? null
}

function isDeleteKey(k: string): boolean {
  return k === 'delete' || k === 'backspace'
}
