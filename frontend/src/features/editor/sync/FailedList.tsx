import { useEffect } from 'react'
import { describeEntry } from './syncText'
import { syncLifecycle, useSync } from './syncStore'

/** The changes the server refused: what each was, the server's message, and Dismiss. */
export function FailedList({ onEmpty }: { onEmpty: () => void }) {
  const failed = useSync((s) => s?.failed ?? [])
  useEffect(() => {
    if (failed.length === 0) onEmpty()
  }, [failed.length, onEmpty])
  return (
    <ul className="panel absolute right-0 top-full z-30 flex w-80 flex-col gap-2 shadow-lg">
      {failed.map((f) => (
        <li key={f.entry.seq} className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 flex-col">
            <span className="font-medium">{describeEntry(f.entry)}</span>
            <span className="text-muted">{f.message}</span>
          </span>
          <button type="button" className="btn" onClick={() => void syncLifecycle.current()?.dismiss(f.entry.seq)}>Dismiss</button>
        </li>
      ))}
    </ul>
  )
}
