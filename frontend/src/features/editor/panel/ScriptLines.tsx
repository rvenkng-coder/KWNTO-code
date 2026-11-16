import { useCallback, useMemo, useState } from 'react'
import type { ScriptLine } from '../../../backend'
import { linesOf } from '../model/state'
import { useEditor } from '../store/editorStore'
import { edits } from '../store/edits'
import { insertRow, moveRow } from './rowActions'
import { ScriptLineRow } from './ScriptLineRow'

// The script lines of one node, in order (design 9c). Enter in a line adds one below it and
// moves there; Backspace in an empty line deletes it and moves to the line above.

export function ScriptLines({ projectId, nodeId }: { projectId: string; nodeId: string }) {
  const content = useEditor((s) => s.content)
  const lines = useMemo(() => linesOf(content, nodeId), [content, nodeId])
  const allLines = useMemo(() => Object.values(content.lines), [content.lines])
  const [focusId, setFocusId] = useState<string | null>(null)
  const clearFocus = useCallback(() => setFocusId(null), [])

  const add = async (index: number) => {
    const make = (id: string, sortOrder: number): ScriptLine => ({ id, projectId, nodeId, character: '', text: '', sortOrder, version: 0 })
    setFocusId(await insertRow('script_lines', lines, index, make))
  }
  const remove = (index: number, focusAbove: boolean) => {
    const line = lines[index]
    if (line === undefined) return
    if (focusAbove) setFocusId(lines[index - 1]?.id ?? null)
    void edits.remove('script_lines', line.id, 'Delete line')
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold">Script</h3>
      <ol className="flex flex-col gap-2">
        {lines.map((line, i) => (
          <ScriptLineRow
            key={line.id} line={line} allLines={allLines} focus={focusId === line.id} onFocused={clearFocus}
            onEnter={() => void add(i + 1)} onBackspaceEmpty={() => remove(i, true)} onDelete={() => remove(i, false)}
            onMove={(by) => void moveRow('script_lines', lines, line.id, i + by)}
            isFirst={i === 0} isLast={i === lines.length - 1}
          />
        ))}
      </ol>
      <button type="button" className="btn self-start" onClick={() => void add(lines.length)}>Add line</button>
    </section>
  )
}
