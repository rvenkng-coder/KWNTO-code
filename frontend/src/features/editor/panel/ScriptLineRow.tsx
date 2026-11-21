import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react'
import type { ScriptLine } from '../../../backend'
import { characterSuggestions } from '../model/characters'
import { EditingBadge } from '../../presence/EditingBadge'
import { presenceFocus } from '../../presence/usePresence'
import { useSavedText } from '../store/useSavedText'
import { ToolButton } from '../canvas/ToolButton'
import { useRowDrag } from './rowDrag'
import { CARD, Grip } from './RowControls'

export interface LineRowProps {
  line: ScriptLine
  /** Every line of the project, for the character suggestions. */
  allLines: ScriptLine[]
  focus: boolean
  onFocused(): void
  onEnter(): void
  onBackspaceEmpty(): void
  onMove(id: string, toIndex: number): void
  onDelete(): void
  index: number
}

/** One script line (design 9c): character and text, each saved on its own. */
export function ScriptLineRow({ line, allLines, focus, onFocused, onEnter, onBackspaceEmpty, onMove, onDelete, index }: LineRowProps) {
  const [who, setWho, flushWho] = useSavedText('script_lines', line.id, 'character', line.character)
  const [text, setText, flushText] = useSavedText('script_lines', line.id, 'text', line.text)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const names = useMemo(() => characterSuggestions(allLines, who), [allLines, who])
  const listId = `characters-${line.id}`
  const field = `line:${line.id}`
  const marks = presenceFocus(line.nodeId, field)
  const drag = useRowDrag('script_lines', line.id, index, (to) => onMove(line.id, to), (from) => onMove(from, index))

  useEffect(() => {
    if (!focus) return
    textRef.current?.focus()
    onFocused()
  }, [focus, onFocused])

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      flushText()
      onEnter()
    } else if (e.key === 'Backspace' && who === '' && text === '') {
      e.preventDefault()
      onBackspaceEmpty()
    }
  }

  return (
    <li data-testid="line-row" className={`${CARD} ${drag.over ? 'border-accent' : 'border-border'}`} {...drag.row}>
      <div className="flex items-center gap-1">
        <Grip what="line" extra={drag.grip} />
        <input className="field min-w-0 flex-1" aria-label="Character" placeholder="Character" value={who} list={listId}
          onChange={(e) => setWho(e.target.value)} onFocus={marks.onFocus} onBlur={() => {
            marks.onBlur()
            flushWho()
          }} />
        <ToolButton icon="trash" name="Delete line" danger align="end" onClick={onDelete} />
      </div>
      <EditingBadge nodeId={line.nodeId} field={field} />
      <datalist id={listId}>{names.map((n) => <option key={n} value={n} />)}</datalist>
      <textarea ref={textRef} className="field" aria-label="Line text" placeholder="Line" rows={2} value={text}
        onChange={(e) => setText(e.target.value)} onFocus={marks.onFocus} onBlur={() => {
          marks.onBlur()
          flushText()
        }} onKeyDown={onKeyDown} />
    </li>
  )
}
