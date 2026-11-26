import { useEffect, useRef, type ChangeEvent } from 'react'
import type { StoryNode } from '../../../backend/index.ts'
import { MediaItem } from './MediaItem.tsx'
import { mediaOf, removedOf } from './mediaList.ts'
import { RemovedMediaItem } from './RemovedMediaItem.tsx'
import { StorageMeter } from './StorageMeter.tsx'
import { useSync } from '../sync/syncStore.ts'
import { acceptFor } from './uploadCheck.ts'
import { useOnline } from './useOnline.ts'
import { useMediaStore } from './useProjectMedia.ts'

// Uploads are never queued (media plan D9, design 6.7), so they need the browser online AND the editor's
// own connection: with the live stream down or the server unreachable the editor says Offline, and the
// upload button follows it instead of failing with a banner.
function useConnected(): boolean {
  const browserOnline = useOnline()
  const editorOnline = useSync((s) => s === null || s.online)
  return browserOnline && editorOnline
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

  const isOnline = useConnected()
  // An error caused by going offline (a load or upload that lost the connection) is not shown and is
  // dropped, so it does not come back as a stale banner after the editor reconnects.
  useEffect(() => {
    if (!isOnline) useMediaStore.getState().setError(null)
  }, [isOnline])

  // An error belongs to the node it happened on. Moving to another node clears it; the first
  // render does not, so an error from opening the project stays visible.
  const shownNodeId = useRef(node.id)
  useEffect(() => {
    if (shownNodeId.current === node.id) return
    shownNodeId.current = node.id
    useMediaStore.getState().setError(null)
  }, [node.id])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void upload(node.id, file)
      e.target.value = ''
    }
  }

  const nodeMedia = mediaOf(media, node.id, node.coverMediaId)
  const removedMedia = storage?.isLead ? removedOf(media, node.id) : []

  return (
    <div data-testid="media-section" className="flex flex-col gap-2 border-t border-border pt-4">
      <div className="flex flex-col gap-0.5">
        <h4 className="text-sm font-semibold">Media</h4>
        <StorageMeter info={storage} />
      </div>

      <label
        className={`btn self-start flex items-center gap-1 text-sm ${!isOnline ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span>Add media</span>
        <input
          type="file"
          aria-label="Add media"
          accept={acceptFor(storage?.allowedTypes ?? null)}
          disabled={!isOnline}
          onChange={handleFileChange}
          className="hidden"
        />
      </label>

      {!isOnline && (
        <p className="text-xs text-muted">Uploads need a connection. Try again when you are back online.</p>
      )}

      {error && isOnline && (
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
