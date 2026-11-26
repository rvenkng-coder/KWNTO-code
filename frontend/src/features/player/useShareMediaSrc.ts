import { useSource } from '../share/useShareSource'
import type { UseMediaSrc } from './PlayerMedia'

/**
 * The media loader of a share link's player. A view link loads straight from the share route; a comment link
 * fetches a blob with the person's token, because an audio element cannot add a header (the rule of `ShareMedia`).
 */
export function shareMediaSrc(token: string, needsSignIn: boolean): UseMediaSrc {
  return (media) => useSource(token, media.id, needsSignIn)
}
