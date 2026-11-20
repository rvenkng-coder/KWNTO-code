import { useEffect, useState, type ChangeEvent } from 'react'
import type { StoryNode } from '../../../backend/index.ts'
import { MediaItem } from './MediaItem.tsx'
import { mediaOf, removedOf } from './mediaList.ts'
import { RemovedMediaItem } from './RemovedMediaItem.tsx'
import { StorageMeter } from './StorageMeter.tsx'
import { useMediaStore } from './useProjectMedia.ts'

function useOnline(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
  return isOnline
}

export function MediaSection({ node }: { node: StoryNode }) {
  const media = useMediaStore((s) => s.media)
  const storage = useMediaStore((s) => s.storage)
  const uploading = useMediaStore((s) => s.uploading)
  const error = useMediaStore((s) => s.error)
  const fileToken = useMediaStore((s) => s.fileToken)
  const upload = useMediaStore((s) => s.upload)
  const remove = useMediaStore((s) => s.remove)
  const restore = useMediaStore((s) => s.restore)
  const deletePermanently = useMediaStore((s) => s.deletePermanently)

  const isOnline = useOnline()

  // An error belongs to the node it happened on.
  useEffect(() => {
    useMediaStore.getState().setError(null)
  }, [node.id])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void upload(node.id, file)
      e.target.value = ''
    }
  }

  const nodeMedia = mediaOf(media, node.id)
  const removedMedia = storage?.isLead ? removedOf(media, node.id) : []

  return (
    <div data-testid="media-section" className="flex flex-col gap-2 border-t border-border pt-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Media</h4>
        <StorageMeter info={storage} />
      </div>

      <label className={`btn self-start flex items-center gap-1 text-sm ${!isOnline ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
        <span>Add media</span>
        <input
          type="file"
          aria-label="Add media"
          accept=".wav,.mp3,.mov,.mp4,.jpg,.jpeg,.png"
          disabled={!isOnline}
          onChange={handleFileChange}
          className="hidden"
        />
      </label>

      {!isOnline && (
        <p className="text-xs text-muted">
          Uploads need a connection. Try again when you are back online.
        </p>
      )}

      {error && (
        <div role="alert" className="text-xs text-danger">
          {error}
        </div>
      )}

      {uploading.map((title, i) => (
        <p key={`${i}-${title}`} className="text-xs text-muted">
          Uploading {title}…
        </p>
      ))}

      <div className="flex flex-col gap-2">
        {nodeMedia.map((m) => (
          <MediaItem key={m.id} media={m} token={fileToken ?? ''} onRemove={remove} />
        ))}
      </div>

      {removedMedia.length > 0 && (
        <div className="flex flex-col gap-2">
          <h5 className="text-xs font-semibold">Removed by the team</h5>
          {removedMedia.map((m) => (
            <RemovedMediaItem key={m.id} media={m} onRestore={restore} onDeletePermanently={deletePermanently} />
          ))}
        </div>
      )}
    </div>
  )
}
