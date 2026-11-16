import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { ScriptLine } from '../../../backend'
import { useSavedText } from '../store/useSavedText'

export interface LineRowProps {
  line: ScriptLine
  focus: boolean
  onFocused(): void
  onEnter(): void
  onBackspaceEmpty(): void
  onMove(by: -1 | 1): void
  onDelete(): void
  isFirst: boolean
  isLast: boolean
}

/** One script line (design 9c): character and text, each saved on its own. */
export function ScriptLineRow({ line, focus, onFocused, onEnter, onBackspaceEmpty, onMove, onDelete, isFirst, isLast }: LineRowProps) {
  const [who, setWho, flushWho] = useSavedText('script_lines', line.id, 'character', line.character)
  const [text, setText, flushText] = useSavedText('script_lines', line.id, 'text', line.text)
  const textRef = useRef<HTMLTextAreaElement>(null)

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
    <li data-testid="line-row" className="flex flex-col gap-1 border-b border-border pb-2">
      <input className="field" aria-label="Character" placeholder="Character" value={who}
        onChange={(e) => setWho(e.target.value)} onBlur={flushWho} />
      <textarea ref={textRef} className="field" aria-label="Line text" placeholder="Line" rows={2} value={text}
        onChange={(e) => setText(e.target.value)} onBlur={flushText} onKeyDown={onKeyDown} />
      <div className="flex gap-1">
        <button type="button" className="btn" disabled={isFirst} onClick={() => onMove(-1)}>Move up</button>
        <button type="button" className="btn" disabled={isLast} onClick={() => onMove(1)}>Move down</button>
        <button type="button" className="btn-danger" onClick={onDelete}>Delete line</button>
      </div>
    </li>
  )
}
