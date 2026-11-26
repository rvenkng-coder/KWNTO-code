import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { backend } from '../../../backend/index.ts'
import type { Media } from '../../../backend/media-types.ts'

/** A popup that shows an image or plays audio or video at full size; Escape, the backdrop or Close dismisses it. */
export function MediaViewer({ media, token, onClose }: { media: Media; token: string; onClose(): void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const url = backend.media.fileUrl(media, token)
  // A portal: the card sits inside the canvas's transformed viewport, which would trap a fixed popup.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={media.title}
        className="panel flex max-h-full max-w-3xl flex-col gap-2 overflow-auto shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="truncate font-semibold">{media.title}</p>
        {media.kind === 'image' && (
          <img src={url} alt={media.title} className="max-h-[70vh] max-w-full object-contain" />
        )}
        {media.kind === 'audio' && <audio controls autoFocus src={url} className="w-full min-w-72" />}
        {media.kind === 'video' && <video controls autoFocus src={url} className="max-h-[70vh] max-w-full bg-black" />}
        <button type="button" className="btn self-end" autoFocus={media.kind === 'image'} onClick={onClose}>
          Close
        </button>
      </div>
    </div>,
    document.body,
  )
}
