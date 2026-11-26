import { useContext } from 'react'
import { CoverSource } from './coverSource'
import { useSource } from './useShareSource'

function CoverImage({ mediaId, title }: { mediaId: string; title: string }) {
  const { token, needsSignIn } = useContext(CoverSource)
  const { src, gone, onError } = useSource(token, mediaId, needsSignIn)
  // A cover that cannot be loaded leaves the card without one; the node's panel says "Media removed".
  if (gone || src === null) return null
  return <img src={src} alt={title} onError={onError} draggable={false} className="block h-auto max-h-64 w-full object-contain" />
}

/** The node's cover image on top of its card in the viewer, at the card's width and its own proportions. */
export function ShareCover({ mediaId }: { mediaId: string }) {
  const cover = useContext(CoverSource).media.find((m) => m.id === mediaId && m.kind === 'image')
  // Keyed: another cover starts loading afresh, whatever happened to the last one.
  return cover === undefined ? null : <CoverImage key={cover.id} mediaId={cover.id} title={cover.title} />
}
