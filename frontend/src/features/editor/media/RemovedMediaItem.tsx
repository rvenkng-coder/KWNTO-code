import { useState } from 'react'
import type { Media } from '../../../backend/media-types.ts'
import { formatSize } from './uploadCheck.ts'

interface RemovedMediaItemProps {
  media: Media
  onRestore: (media: Media) => Promise<void>
  onDeletePermanently: (media: Media) => Promise<void>
}

// Shown to the team lead only: media a member removed. It still uses the lead's storage
// until it is deleted for good.
export function RemovedMediaItem({ media, onRestore, onDeletePermanently }: RemovedMediaItemProps) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = async (action: (m: Media) => Promise<void>) => {
    setBusy(true)
    try {
      await action(media)
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <div data-testid="removed-media-item" className="flex flex-col gap-1 rounded-base border border-border p-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate" title={media.title}>{media.title}</span>
        <span className="text-muted">{formatSize(media.sizeBytes)}</span>
      </div>
      {confirming ? (
        <div className="flex flex-col gap-1">
          <span>Delete {media.title} for good? This cannot be undone.</span>
          <div className="flex gap-2">
            <button type="button" className="btn btn-sm btn-danger text-xs" disabled={busy} onClick={() => void run(onDeletePermanently)}>
              Delete for good
            </button>
            <button type="button" className="btn btn-sm text-xs" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" className="btn btn-sm text-xs" disabled={busy} onClick={() => void run(onRestore)}>
            Restore
          </button>
          <button type="button" className="btn btn-sm text-xs" disabled={busy} onClick={() => setConfirming(true)}>
            Delete for good
          </button>
        </div>
      )}
    </div>
  )
}
