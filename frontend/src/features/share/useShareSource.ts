import { useEffect, useState } from 'react'
import { backend } from '../../backend'

// A view link's media loads straight from the route (an <img> or <audio> cannot add a header).
// A comment link's needs the person's token, so it is fetched and shown from a blob. Either
// way, a 404 (the file was deleted for good) shows "Media removed" instead of a broken player.
export function useSource(
  token: string,
  mediaId: string,
  signedIn: boolean,
): { src: string | null; gone: boolean; onError: () => void } {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (!signedIn) return
    let url: string | null = null
    let cancelled = false
    backend.shares
      .mediaBlob(token, mediaId)
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setBlobUrl(url)
      })
      .catch(() => {
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
