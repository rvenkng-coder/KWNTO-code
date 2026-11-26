import { useState } from 'react'
import { backend } from '../../../backend/index.ts'
import type { Media } from '../../../backend/media-types.ts'
import { formatSize } from './uploadCheck.ts'

interface MediaItemProps {
  media: Media
  token: string
  onRemove: (media: Media) => Promise<void>
}

export function MediaItem({ media, token, onRemove }: MediaItemProps) {
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)

  const handleRemove = async () => {
    setRemoving(true)
    try {
      await onRemove(media)
    } finally {
      setRemoving(false)
      setConfirming(false)
    }
  }

  const thumbUrl = token ? backend.media.fileUrl(media, token, '100x100') : ''
  const fullUrl = token ? backend.media.fileUrl(media, token) : ''

  return (
    <div
      data-testid="media-item"
      className="panel flex flex-col gap-2 rounded-base border border-border p-2 bg-surface text-text"
    >
      <div className="flex items-center gap-2">
        {media.kind === 'image' && (
          <img src={thumbUrl} alt={media.title} className="h-12 w-12 rounded object-cover border border-border" />
        )}
        <div className="flex flex-1 flex-col overflow-hidden">
          <span className="truncate text-sm font-medium" title={media.title}>
            {media.title}
          </span>
          <span className="text-xs text-muted">{formatSize(media.sizeBytes)}</span>
        </div>
        {!confirming && (
          <button type="button" className="btn btn-sm self-center text-xs" onClick={() => setConfirming(true)}>
            Remove
          </button>
        )}
      </div>

      {media.kind === 'audio' && fullUrl && <audio controls src={fullUrl} className="w-full h-8" />}

      {media.kind === 'video' && fullUrl && (
        <video controls src={fullUrl} className="w-full max-h-40 rounded bg-black" />
      )}

      {confirming && (
        <div className="flex flex-col gap-1 border-t border-border pt-2 text-xs">
          <span>Remove {media.title} from this node? The team lead can bring it back.</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-danger text-xs"
              disabled={removing}
              onClick={() => void handleRemove()}
            >
              Remove
            </button>
            <button
              type="button"
              className="btn btn-sm text-xs"
              disabled={removing}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
