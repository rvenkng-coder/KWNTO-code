import { useState } from 'react'
import { FailedList } from './FailedList'
import { failedText, statusText } from './outboxText'
import { useSync } from './syncStore'

/** The top bar's sync line: offline with N changes waiting, saving, and the changes that could not be saved. */
export function SyncStatus() {
  const text = useSync((s) => (s === null ? null : statusText(s.online, s.waiting)))
  const failed = useSync((s) => s?.failed.length ?? 0)
  const [open, setOpen] = useState(false)
  if (text === null && failed === 0) return null
  return (
    <div data-testid="sync-status" className="relative flex items-center gap-2 text-sm">
      {text !== null && <span>{text}</span>}
      {failed > 0 && (
        <>
          <span className="text-danger">{failedText(failed)}</span>
          <button type="button" className="btn" onClick={() => setOpen((o) => !o)}>
            Show
          </button>
        </>
      )}
      {failed > 0 && open && <FailedList onEmpty={() => setOpen(false)} />}
    </div>
  )
}
