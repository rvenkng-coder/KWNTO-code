// What an <audio> or <video> `error` event means.

const DECODE_FAILED = 3 // MediaError.MEDIA_ERR_DECODE
const NOTHING_LOADED = 0 // HTMLMediaElement.HAVE_NOTHING

export interface MediaElementState {
  error: { code: number } | null
  readyState: number
}

/**
 * Whether the file could not be loaded, which is when `Media removed` is shown. A decode error on a
 * file that had already loaded is a playback problem (a missing audio device raises one), so the player stays.
 */
export function failedToLoad({ error, readyState }: MediaElementState): boolean {
  return error?.code !== DECODE_FAILED || readyState === NOTHING_LOADED
}
