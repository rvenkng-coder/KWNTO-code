import type { SyntheticEvent } from 'react'
import type { ShareOpen } from '../../backend'
import { failedToLoad } from './mediaError'
import { useSource } from './useShareSource'

type Media = ShareOpen extends infer O
  ? O extends { file: infer F }
    ? F extends { media: (infer M)[] }
      ? M
      : never
    : never
  : never

export const MEDIA_GONE = 'Media removed'

/** One media file of the shared node: an image, an audio or a video player, or `Media removed`. */
export function ShareMedia({ token, media, needsSignIn }: { token: string; media: Media; needsSignIn: boolean }) {
  const { src, gone, onError } = useSource(token, media.id, needsSignIn)
  if (gone) return <p className="text-sm text-muted">{MEDIA_GONE}</p>
  if (src === null) return null
  const failPlayer = (e: SyntheticEvent<HTMLMediaElement>) => {
    if (failedToLoad(e.currentTarget)) onError()
  }
  return (
    <figure className="flex flex-col gap-1">
      {media.kind === 'image' && (
        <img
          data-testid="share-media"
          src={src}
          alt={media.title}
          onError={onError}
          className="max-h-48 rounded-base border border-border object-contain"
        />
      )}
      {media.kind === 'audio' && (
        <audio data-testid="share-media" controls src={src} onError={failPlayer} className="w-full" />
      )}
      {media.kind === 'video' && (
        <video data-testid="share-media" controls src={src} onError={failPlayer} className="w-full" />
      )}
      <figcaption className="text-xs text-muted">{media.title}</figcaption>
    </figure>
  )
}
