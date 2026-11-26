import { useState, type ChangeEvent } from 'react'
import type { StoryNode } from '../../../backend/index.ts'
import { backend } from '../../../backend/index.ts'
import { MediaViewer } from '../canvas/MediaViewer.tsx'
import { edits } from '../store/edits.ts'
import { coverOf } from './mediaList.ts'
import { useMediaStore } from './useProjectMedia.ts'

// A cover is an ordinary image upload (same file checks, same team storage) that the node names as
// its cover; it is kept out of the Media list below. Uploads are never queued (design 6.7), so the
// button is off while the editor is not connected, as in the Media section.
export function CoverSection({ node }: { node: StoryNode }) {
  const cover = useMediaStore((s) => coverOf(s.media, node.coverMediaId))
  const token = useMediaStore((s) => s.fileToken)
  const upload = useMediaStore((s) => s.upload)
  const remove = useMediaStore((s) => s.remove)
  const [viewing, setViewing] = useState(false)
  const [busy, setBusy] = useState(false)

  const choose = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const created = await upload(node.id, file)
      // Only an image can be a cover; anything else stays an ordinary media file.
      if (created?.kind === 'image')
        await edits.update('nodes', node.id, { coverMediaId: created.id }, 'Set cover image')
      // A replaced cover is removed like any media file, so it does not reappear in the Media list.
      if (created?.kind === 'image' && cover !== undefined) await remove(cover)
    } finally {
      setBusy(false)
    }
  }

  const clear = async () => {
    if (cover === undefined) return
    await edits.update('nodes', node.id, { coverMediaId: '' }, 'Remove cover image')
    // The file goes the same way as removed media: hidden, still in the team lead's storage.
    await remove(cover)
  }

  return (
    <div data-testid="cover-section" className="flex flex-col gap-2 border-t border-border pt-4">
      <h4 className="text-sm font-semibold">Cover image</h4>
      {cover !== undefined && token && (
        <button
          type="button"
          title={`View ${cover.title}`}
          className="block w-full cursor-pointer rounded-base border border-border bg-bg p-0"
          onClick={() => setViewing(true)}
        >
          <img
            src={backend.media.fileUrl(cover, token, '100x100')}
            alt={cover.title}
            className="mx-auto block h-24 object-contain"
          />
        </button>
      )}
      <div className="flex gap-2">
        <label
          className={`btn flex items-center gap-1 text-sm ${busy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
          <span>{cover === undefined ? 'Add cover image' : 'Replace cover image'}</span>
          <input
            type="file"
            aria-label="Add cover image"
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            disabled={busy}
            onChange={(e) => void choose(e)}
            className="hidden"
          />
        </label>
        {cover !== undefined && (
          <button type="button" className="btn text-sm" onClick={() => void clear()}>
            Remove cover
          </button>
        )}
      </div>
      {viewing && cover !== undefined && token && (
        <MediaViewer media={cover} token={token} onClose={() => setViewing(false)} />
      )}
    </div>
  )
}
