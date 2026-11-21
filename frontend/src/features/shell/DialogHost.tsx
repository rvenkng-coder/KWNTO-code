import { useId, useState } from 'react'
import { useDialogs } from './dialogs'

/** Draws the question that `askConfirm` or `askText` is waiting on (modal; Escape cancels, Enter confirms). */
export function DialogHost() {
  const current = useDialogs((s) => s.current)
  const [text, setText] = useState('')
  const titleId = useId()
  if (current === null) return null
  const answer = (ok: boolean) => {
    useDialogs.setState({ current: null })
    setText('')
    if (current.kind === 'confirm') current.resolve(ok)
    else current.resolve(ok && text.trim() !== '' ? text.trim() : null)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onKeyDown={(e) => e.key === 'Escape' && answer(false)}>
      <form
        role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="panel flex w-[28rem] max-w-full flex-col gap-3 shadow-lg"
        onSubmit={(e) => { e.preventDefault(); answer(true) }}
      >
        {current.kind === 'confirm'
          ? <p id={titleId}>{current.message}</p>
          : (
            <label id={titleId} className="flex flex-col gap-1">
              {current.label}
              <input className="field" autoFocus value={text} onChange={(e) => setText(e.target.value)} />
            </label>
          )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => answer(false)}>Cancel</button>
          <button type="submit" className="btn-primary" autoFocus={current.kind === 'confirm'} disabled={current.kind === 'prompt' && text.trim() === ''}>
            {current.confirmLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
