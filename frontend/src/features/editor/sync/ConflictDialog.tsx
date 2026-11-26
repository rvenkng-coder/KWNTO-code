import { useEditor } from '../store/editorStore'
import { conflictHeading, conflictRows } from './syncText'
import { syncLifecycle, useSync } from './syncStore'

/** An edit made offline met someone else's change to the same thing: keep mine or keep theirs. Modal; the queue waits (D12). */
export function ConflictDialog() {
  const conflict = useSync((s) => s?.conflict ?? null)
  const nodes = useEditor((s) => s.content.nodes)
  if (conflict === null) return null
  const rows = conflictRows(conflict, (id) => nodes[id]?.title)
  const resolve = (choice: 'mine' | 'theirs') => void syncLifecycle.current()?.resolve(choice)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-heading"
        className="panel flex w-[28rem] max-w-full flex-col gap-3 shadow-lg"
      >
        <h2 id="conflict-heading" className="text-lg font-semibold">
          {conflictHeading(conflict)}
        </h2>
        {conflict.deleted && <p>Keep mine puts it back with your changes.</p>}
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-1">
            <span className="font-medium">{r.label}</span>
            <span>Yours: {r.yours}</span>
            <span>Theirs: {r.theirs}</span>
          </div>
        ))}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => resolve('mine')}>
            Keep mine
          </button>
          <button type="button" className="btn" onClick={() => resolve('theirs')}>
            Keep theirs
          </button>
        </div>
      </div>
    </div>
  )
}
