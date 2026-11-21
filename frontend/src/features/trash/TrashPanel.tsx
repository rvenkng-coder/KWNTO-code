import { useEffect, useMemo, useState } from 'react'
import { backend } from '../../backend'
import { useEditor } from '../editor/store/editorStore'
import { edits } from '../editor/store/edits'
import { daysLeft, trashedItems, trashLabel } from './trashList'

// The project's trash (design 6.8): one row per trashed chapter and node, with the days left
// and Restore. Restoring is an ordinary edit through the editor store, so it can be undone
// and is queued while offline like any other. A node of a trashed chapter comes back with
// its chapter, so its row says so instead of offering a button.

const DEFAULT_RETENTION = 30

function useRetentionDays(): number | null {
  const [days, setDays] = useState<number | null>(null)
  useEffect(() => {
    let current = true
    backend.appSettings
      .get()
      .then((s) => current && setDays(s.trashRetentionDays))
      // The label is a courtesy: when the settings cannot be read, show the default window.
      .catch(() => current && setDays(DEFAULT_RETENTION))
    return () => {
      current = false
    }
  }, [])
  return days
}

interface RowProps { title: string; label: string; action: React.ReactNode }

function Row({ title, label, action }: RowProps) {
  return (
    <li className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <span className="text-muted">{label}</span>
      {action}
    </li>
  )
}

export function TrashPanel({ onClose }: { onClose(): void }) {
  const content = useEditor((s) => s.content)
  const retention = useRetentionDays()
  const items = useMemo(() => trashedItems(content), [content])
  // Fixed when the panel opens: the labels count whole days, so they need no ticking clock.
  const [now] = useState(() => Date.now())
  const label = (at: string | null): string => trashLabel(at === null ? retention ?? DEFAULT_RETENTION : daysLeft(at, retention ?? DEFAULT_RETENTION, now))
  const empty = items.chapters.length === 0 && items.nodes.length === 0

  return (
    <div role="dialog" aria-label="Trash" className="panel fixed right-4 top-24 z-50 flex max-h-[70vh] w-96 flex-col gap-2 overflow-y-auto">
      <div className="flex items-center gap-2">
        <h3 className="flex-1">Trash</h3>
        <button type="button" className="btn" aria-label="Close trash" onClick={onClose}>×</button>
      </div>
      {retention !== null && empty && <p className="text-muted">The trash is empty.</p>}
      {retention !== null && !empty && (
        <ul className="flex flex-col gap-1">
          {items.chapters.map((c) => (
            <Row
              key={c.id}
              title={`Chapter: ${c.title}`}
              label={label(c.deletedAt)}
              action={<button type="button" className="btn" onClick={() => void edits.update('chapters', c.id, { deleted: false }, 'Restore chapter')}>Restore</button>}
            />
          ))}
          {items.nodes.map(({ node, chapterTrashed }) => {
            const chapter = content.chapters[node.chapterId]
            const at = node.deleted ? node.deletedAt : chapter?.deletedAt ?? null
            return (
              <Row
                key={node.id}
                title={node.title === '' ? 'Untitled node' : node.title}
                label={label(at)}
                action={chapterTrashed
                  ? <span>Restore the chapter {chapter?.title} first.</span>
                  : <button type="button" className="btn" onClick={() => void edits.update('nodes', node.id, { deleted: false }, 'Restore node')}>Restore</button>}
              />
            )
          })}
        </ul>
      )}
    </div>
  )
}
