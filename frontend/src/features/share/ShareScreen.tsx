import { useCallback, useEffect, useRef, useState } from 'react'
import { backend, type ShareOpen } from '../../backend'
import { errorMessage } from '../errorMessage'
import { SignInForm } from '../auth/SignInForm'
import { useSession } from '../auth/useSession'
import { navigate } from '../shell/useRoute'
import { CommentsSection } from '../comments/CommentsSection'
import { useNodeComments } from '../comments/useNodeComments'
import { ReadOnlyViewer } from './ReadOnlyViewer'
import { shouldRefresh } from './shareModel'

type Open = Extract<ShareOpen, { file: unknown }>
type Answer = { status: 'refused'; message: string } | { status: 'viewing'; open: Open }
type State = { status: 'loading' } | Answer

const NEEDS_SIGN_IN = 'Sign in to open this shared project.'

// Reads the link again while a live view is on screen, because the project is not pushed to a link's viewer: every 5 s
// a check whether 30 s have passed and the tab is visible, and at once when the tab becomes visible again.
function useLiveRefresh(kind: 'live' | 'snapshot' | null, reload: () => Promise<void>): void {
  const last = useRef(0)
  useEffect(() => {
    if (kind !== 'live') return
    last.current = Date.now()
    const run = () => {
      last.current = Date.now()
      void reload()
    }
    const timer = setInterval(() => {
      if (shouldRefresh('live', document.visibilityState === 'visible', last.current, Date.now())) run()
    }, 5000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [kind, reload])
}

// Opens the link: an edit link joins and goes to the editor (no answer to show), a comment link
// joins and views, a view link views. A live refresh passes `join = false`: the grant exists already,
// and joining again every 30 s would be a write per viewer per poll.
async function load(token: string, join = true): Promise<Answer | null> {
  try {
    const opened = await backend.shares.open(token)
    if (opened.permission === 'edit') {
      if (join) await backend.shares.join(token)
      navigate({ name: 'project', projectId: opened.projectId, chapterId: null })
      return null
    }
    if (opened.permission === 'comment' && join) await backend.shares.join(token)
    return { status: 'viewing', open: opened }
  } catch (err: unknown) {
    return { status: 'refused', message: errorMessage(err, 'Could not open this link.') }
  }
}

// An answer belongs to the token and the person it was asked for; any other is "still loading".
function useOpenLink(token: string, userId: string | null): [State, () => Promise<void>] {
  const key = `${token}/${userId ?? ''}`
  const [answer, setAnswer] = useState<{ key: string; value: Answer } | null>(null)
  const reload = useCallback(async () => {
    const value = await load(token, false)
    if (value !== null) setAnswer({ key, value })
  }, [token, key])
  useEffect(() => {
    let cancelled = false
    void load(token).then((value) => {
      if (!cancelled && value !== null) setAnswer({ key, value })
    })
    return () => {
      cancelled = true
    }
  }, [token, key])
  return [answer !== null && answer.key === key ? answer.value : { status: 'loading' }, reload]
}

function Refused({ message, signedIn }: { message: string; signedIn: boolean }) {
  const [asking, setAsking] = useState(false)
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-3">
      <p role="alert">{message}</p>
      {message === NEEDS_SIGN_IN && !signedIn && !asking && (
        <button type="button" className="btn-primary self-start" onClick={() => setAsking(true)}>
          Sign in
        </button>
      )}
      {asking && !signedIn && <SignInForm />}
    </div>
  )
}

// A comment link's viewer also shows each node's comments and lets the person write.
function CommentViewer({ open, token }: { open: Open; token: string }) {
  useNodeComments(open.projectId, '')
  return (
    <ReadOnlyViewer
      projectId={open.projectId}
      file={open.file}
      token={token}
      needsSignIn
      renderComments={(nodeId) => <CommentsSection nodeId={nodeId} />}
    />
  )
}

/** The page behind `#/s/<token>` (design 5): works signed out for view links; comment and edit links ask for a sign-in first. */
export function ShareScreen({ token }: { token: string }) {
  const { user } = useSession()
  const [state, reload] = useOpenLink(token, user === null ? null : user.id)
  useLiveRefresh(state.status === 'viewing' ? state.open.kind : null, reload)
  if (state.status === 'loading') return <p>Opening the link…</p>
  if (state.status === 'refused') return <Refused message={state.message} signedIn={user !== null} />
  if (state.open.permission === 'comment') return <CommentViewer open={state.open} token={token} />
  return <ReadOnlyViewer projectId={state.open.projectId} file={state.open.file} token={token} needsSignIn={false} />
}
