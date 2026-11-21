import { useEffect, useState } from 'react'
import { backend, type ShareOpen } from '../../backend'

type Media = ShareOpen extends infer O ? O extends { file: infer F } ? F extends { media: (infer M)[] } ? M : never : never : never

export const MEDIA_GONE = 'Media removed'

// A view link's media loads straight from the route (an <img> or <audio> cannot add a header).
// A comment link's needs the person's token, so it is fetched and shown from a blob. Either
// way, a 404 (the file was deleted for good) shows "Media removed" instead of a broken player.
function useSource(token: string, mediaId: string, signedIn: boolean): { src: string | null; gone: boolean; onError: () => void } {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (!signedIn) return
    let url: string | null = null
    let cancelled = false
    backend.shares.mediaBlob(token, mediaId).then((blob) => {
      if (cancelled) return
      url = URL.createObjectURL(blob)
      setBlobUrl(url)
    }).catch(() => {
      if (!cancelled) setGone(true)
    })
    return () => {
      cancelled = true
      if (url !== null) URL.revokeObjectURL(url)
    }
  }, [token, mediaId, signedIn])
  const src = signedIn ? blobUrl : backend.shares.mediaUrl(token, mediaId)
  return { src, gone, onError: () => setGone(true) }
}

/** One media file of the shared node: an image, an audio or a video player, or `Media removed`. */
export function ShareMedia({ token, media, needsSignIn }: { token: string; media: Media; needsSignIn: boolean }) {
  const { src, gone, onError } = useSource(token, media.id, needsSignIn)
  if (gone) return <p className="text-sm text-muted">{MEDIA_GONE}</p>
  if (src === null) return null
  return (
    <figure className="flex flex-col gap-1">
      {media.kind === 'image' && <img data-testid="share-media" src={src} alt={media.title} onError={onError} className="max-h-48 rounded-base border border-border object-contain" />}
      {media.kind === 'audio' && <audio data-testid="share-media" controls src={src} onError={onError} className="w-full" />}
      {media.kind === 'video' && <video data-testid="share-media" controls src={src} onError={onError} className="w-full" />}
      <figcaption className="text-xs text-muted">{media.title}</figcaption>
    </figure>
  )
}
