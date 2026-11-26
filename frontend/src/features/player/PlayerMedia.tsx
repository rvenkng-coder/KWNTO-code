import { useState } from 'react'
import { MEDIA_GONE } from '../share/ShareMedia'
import type { PlayMedia } from './story'

export interface MediaSrc { src: string | null; gone: boolean; onError(): void }
/** A hook the host passes: the editor, a view link and a comment link each load media their own way. */
export type UseMediaSrc = (media: PlayMedia) => MediaSrc

/** One media file of the node on screen: an image, or audio or video that starts with the node. */
export function PlayerMedia({ media, useMediaSrc }: { media: PlayMedia; useMediaSrc: UseMediaSrc }) {
  const { src, gone, onError } = useMediaSrc(media)
  const [failed, setFailed] = useState(false)
  if (gone || failed) return <p className="text-sm text-muted">{MEDIA_GONE}</p>
  if (src === null) return null
  const fail = () => {
    setFailed(true)
    onError()
  }
  return (
    <figure className="flex flex-col gap-1">
      {media.kind === 'image' && <img data-testid="player-media" src={src} alt={media.title} onError={fail} className="max-h-[50vh] rounded-base object-contain" />}
      {media.kind === 'audio' && <audio data-testid="player-media" controls autoPlay src={src} onError={fail} className="w-full" />}
      {media.kind === 'video' && <video data-testid="player-media" controls autoPlay src={src} onError={fail} className="max-h-[50vh] w-full rounded-base bg-black" />}
    </figure>
  )
}
