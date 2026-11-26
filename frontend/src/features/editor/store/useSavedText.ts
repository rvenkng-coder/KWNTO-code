import { useCallback, useEffect, useRef, useState } from 'react'
import type { ContentKind, EditableFields } from '../../../backend'
import { edits } from './edits'
import { pendingEdits } from './pendingEdits'

// A text field of one record while the person types in it: the text shown is
// local; a save of only that field is scheduled through `pendingEdits` (800 ms after the last
// keystroke, or at once on flush). A teammate's value is taken only while the field is not
// being edited, so it never replaces what the person is typing.

export function useSavedText<K extends ContentKind>(
  kind: K,
  id: string,
  field: keyof EditableFields[K] & string,
  value: string,
): [text: string, setText: (t: string) => void, flush: () => void] {
  const key = `${kind}:${id}:${field}`
  const [text, setLocal] = useState(value)
  const editing = useRef(false)

  // Adopt the stored value when it changes and nothing of ours is waiting.
  useEffect(() => {
    if (!editing.current) setLocal(value)
  }, [value])

  const setText = useCallback(
    (t: string) => {
      editing.current = true
      setLocal(t)
      pendingEdits.set(key, () => {
        editing.current = false
        const changes = { [field]: t } as Partial<EditableFields[K]>
        void edits.update(kind, id, changes, `Edit ${field}`)
      })
    },
    [key, kind, id, field],
  )

  const flush = useCallback(() => pendingEdits.flush(key), [key])

  // A field that goes away (node deselected, row deleted) saves what was typed first.
  useEffect(() => () => pendingEdits.flush(key), [key])

  return [text, setText, flush]
}
