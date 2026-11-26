// Keeps the media live subscription open only while the app is online, like the editor's own
// (editorSession.ts): going offline closes it, coming back opens it again and reloads.
// This matters beyond tidiness: the PocketBase SDK drops its event stream only when the last
// subscription is closed. A media subscription left open would keep the stream in its retry loop,
// and the editor's reopen after reconnecting would then not wait for the connection.

export interface OnlinePort {
  online(): boolean
  subscribe(fn: () => void): () => void
}

type Closer = () => void

/** Opens now, follows the connection, and returns the function that stops it all. */
export function keepMediaOpen(open: () => Promise<Closer>, port: OnlinePort): () => void {
  let close: Closer | null = null
  let generation = 0
  let wasOnline = port.online()
  let stopped = false

  const start = () => {
    const mine = ++generation
    void open().then((closer) => {
      if (stopped || mine !== generation) closer()
      else close = closer
    })
  }
  const stop = () => {
    generation++
    close?.()
    close = null
  }

  if (wasOnline) start()
  const unwatch = port.subscribe(() => {
    const online = port.online()
    if (online === wasOnline) return
    wasOnline = online
    if (online) start()
    else stop()
  })

  return () => {
    stopped = true
    unwatch()
    stop()
  }
}
