import { useMemo, useState } from 'react'
import { backend } from '../../../backend/index.ts'
import type { Media } from '../../../backend/media-types.ts'
import { linkLabel, safeHref } from '../links/linkCheck.ts'
import { linksOf } from '../links/linksList.ts'
import { useLinksStore } from '../links/useProjectLinks.ts'
import { mediaOf } from '../media/mediaList.ts'
import { useMediaStore } from '../media/useProjectMedia.ts'
import { MediaViewer } from './MediaViewer.tsx'

const SHOWN_LINKS = 2
const SHOWN_MEDIA = 3

/** The node's links on its card (comments stay in the panel): the first few, then a count of the rest. */
function CardLinks({ nodeId }: { nodeId: string }) {
  const all = useLinksStore((s) => s.links)
  const links = useMemo(() => linksOf(all, nodeId), [all, nodeId])
  if (links.length === 0) return null
  return (
    <div data-testid="card-links" className="flex flex-col gap-0.5 px-3 pb-1.5 text-[0.85em]">
      {links.slice(0, SHOWN_LINKS).map((l) => {
        const href = safeHref(l.url)
        // nodrag: a press on a link must not start a drag of the card.
        return href === null
          ? <span key={l.id} className="truncate text-muted">{linkLabel(l)}</span>
          : <a key={l.id} href={href} target="_blank" rel="noopener noreferrer" className="nodrag truncate text-accent hover:underline"
              onClick={(e) => e.stopPropagation()}>{linkLabel(l)}</a>
      })}
      {links.length > SHOWN_LINKS && <p className="text-muted">+{links.length - SHOWN_LINKS} more links</p>}
    </div>
  )
}

/** The node's media on its card: small previews; a click opens the media in a popup to view or play. */
function CardMedia({ nodeId }: { nodeId: string }) {
  const all = useMediaStore((s) => s.media)
  const token = useMediaStore((s) => s.fileToken)
  const items = useMemo(() => mediaOf(all, nodeId), [all, nodeId])
  const [open, setOpen] = useState<Media | null>(null)
  if (items.length === 0) return null
  const icon = (k: Media['kind']) => (k === 'audio' ? '♪' : k === 'video' ? '▶' : '▣')
  return (
    <div data-testid="card-media" className="flex flex-wrap items-center gap-1 px-3 pb-1.5 text-[0.85em]">
      {items.slice(0, SHOWN_MEDIA).map((m) => (
        // nodrag: a press must not start a drag of the card.
        <button key={m.id} type="button" title={`${m.kind === 'image' ? 'View' : 'Play'} ${m.title}`} disabled={!token}
          className="nodrag max-w-full cursor-pointer rounded-base border border-border bg-bg p-0 hover:border-accent"
          onClick={(e) => {
            e.stopPropagation()
            setOpen(m)
          }}>
          {m.kind === 'image' && token
            ? <img src={backend.media.fileUrl(m, token, '100x100')} alt={m.title} className="block h-[3em] w-[3em] rounded-base object-cover" />
            : <span className="block max-w-full truncate px-1.5 py-0.5">{icon(m.kind)} {m.title}</span>}
        </button>
      ))}
      {items.length > SHOWN_MEDIA && <span className="text-muted">+{items.length - SHOWN_MEDIA} more</span>}
      {open !== null && token && <MediaViewer media={open} token={token} onClose={() => setOpen(null)} />}
    </div>
  )
}

export function CardAttachments({ nodeId }: { nodeId: string }) {
  return (
    <>
      <CardMedia nodeId={nodeId} />
      <CardLinks nodeId={nodeId} />
    </>
  )
}
