import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { backend } from '../../../backend/index.ts'
import type { Media } from '../../../backend/media-types.ts'
import { linkLabel, safeHref } from '../links/linkCheck.ts'
import { linksOf } from '../links/linksList.ts'
import { useLinksStore } from '../links/useProjectLinks.ts'
import { mediaOf } from '../media/mediaList.ts'
import { useMediaStore } from '../media/useProjectMedia.ts'
import { MediaViewer } from './MediaViewer.tsx'
import { rowOf, tilesThatFit } from './mediaTiles.ts'

const SHOWN_LINKS = 2

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

const TILE_GAP = 4

/**
 * Watches the media row: its width (how many tiles fit) and its height, which is the tile size, since the row is
 * one tile high. Reading the height means a change of the Media size setting re-measures with no extra wiring.
 * `null` until the first measure.
 */
function useRowSize(ref: React.RefObject<HTMLDivElement | null>): { width: number; tile: number } | null {
  const [size, setSize] = useState<{ width: number; tile: number } | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (el === null) return
    const watcher = new ResizeObserver(() => setSize({ width: el.clientWidth, tile: el.clientHeight }))
    watcher.observe(el)
    return () => watcher.disconnect()
  }, [ref])
  return size
}

/**
 * The node's media on its card: one row of square tiles whose size is the account's Media size setting
 * (`--card-media-size`). A wider card shows more; when they do not all fit the last place says "+N more".
 * A click opens the media in a popup to view or play.
 */
function CardMedia({ nodeId, coverMediaId }: { nodeId: string; coverMediaId: string }) {
  const all = useMediaStore((s) => s.media)
  const token = useMediaStore((s) => s.fileToken)
  const items = useMemo(() => mediaOf(all, nodeId, coverMediaId), [all, nodeId, coverMediaId])
  const [open, setOpen] = useState<Media | null>(null)
  const row = useRef<HTMLDivElement>(null)
  const size = useRowSize(row)
  if (items.length === 0) return null
  const icon = (k: Media['kind']) => (k === 'audio' ? '♪' : k === 'video' ? '▶' : '▣')
  const { shown, hidden } = rowOf(items.length, size === null ? items.length : tilesThatFit(size.width, size.tile, TILE_GAP))
  const box = { width: 'var(--card-media-size, 56px)', height: 'var(--card-media-size, 56px)' }
  return (
    <div data-testid="card-media" className="px-3 pb-1.5 text-[0.85em]">
      <div ref={row} className="flex flex-wrap gap-1 overflow-hidden" style={{ height: 'var(--card-media-size, 56px)' }}>
        {items.slice(0, shown).map((m) => (
          // nodrag: a press must not start a drag of the card.
          <button key={m.id} type="button" title={`${m.kind === 'image' ? 'View' : 'Play'} ${m.title}`} disabled={!token} style={box}
            className="nodrag shrink-0 cursor-pointer overflow-hidden rounded-base border border-border bg-bg p-0 hover:border-accent"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(m)
            }}>
            {m.kind === 'image' && token
              ? <img src={backend.media.fileUrl(m, token, '100x100')} alt={m.title} loading="lazy" className="block h-full w-full object-cover" />
              : <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 overflow-hidden px-1 text-center leading-tight"><span>{icon(m.kind)}</span><span className="line-clamp-2 break-all">{m.title}</span></span>}
          </button>
        ))}
        {hidden > 0 && <span data-testid="card-media-more" style={box} className="flex shrink-0 items-center justify-center rounded-base border border-dashed border-border text-center text-muted">+{hidden} more</span>}
      </div>
      {open !== null && token && <MediaViewer media={open} token={token} onClose={() => setOpen(null)} />}
    </div>
  )
}

export function CardAttachments({ nodeId, coverMediaId }: { nodeId: string; coverMediaId: string }) {
  return (
    <>
      <CardMedia nodeId={nodeId} coverMediaId={coverMediaId} />
      <CardLinks nodeId={nodeId} />
    </>
  )
}
