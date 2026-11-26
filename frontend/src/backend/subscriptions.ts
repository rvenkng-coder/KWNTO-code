// Live subscriptions are closed by callers that do not wait for the answer (effect clean-ups, the media
// subscription that follows the connection). Closing sends a request to the server, and while the connection
// is down that request fails; the failure is the PocketBase client's own rejected promise, which nobody
// listens to, so it showed up as an uncaught `Something went wrong.` error. There is nothing to report: a
// subscription that could not be closed died with the connection anyway.

/** The same close function, but it never rejects. */
export function closesQuietly(close: () => Promise<void>): () => Promise<void> {
  return async () => {
    try {
      await close()
    } catch {
      // Closed while offline (or the client is gone): nothing left to close.
    }
  }
}
