import { useState } from 'react'
import { backend } from '../../backend'
import { useMediaStore } from '../editor/media/useProjectMedia'
import type { MediaSrc, UseMediaSrc } from './PlayerMedia'

/**
 * The editor's media loader for the player. The URL is built once, from the first file token this
 * item sees, and kept: the store refreshes its token every 45 s, and a new URL would restart a playing file.
 */
export const useEditorMediaSrc: UseMediaSrc = (media): MediaSrc => {
  const record = useMediaStore((s) => s.media.find((m) => m.id === media.id))
  const token = useMediaStore((s) => s.fileToken)
  const [src, setSrc] = useState<string | null>(null)
  if (src === null && record !== undefined && token !== null) setSrc(backend.media.fileUrl(record, token))
  return { src, gone: false, onError: () => undefined }
}
