import { useEffect, useRef, useState } from 'react'
import { backend } from '../../backend'

export const VERIFY_SUCCESS = 'Your email is verified. You can now create and join teams.'
export const VERIFY_FAILURE = 'This verification link is not valid or has expired. Sign in and ask for a new one.'

type Outcome = 'working' | 'done' | 'failed'

/** The page a verification mail links to (`#/verify/<token>`): confirms once, then says how it went. */
export function VerifyEmailScreen({ token }: { token: string }) {
  const [outcome, setOutcome] = useState<Outcome>('working')
  // StrictMode runs effects twice in development; a second confirm would fail on a used token.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    backend.auth
      .confirmVerification(token)
      .then(async () => {
        // Signed in: the stored session still says "not verified"; fetch the new flag so the gate lifts.
        if (backend.auth.current()) await backend.auth.refresh()
        setOutcome('done')
      })
      .catch(() => setOutcome('failed'))
  }, [token])

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-3 p-4">
      <h1 className="text-lg font-semibold">KWNTO</h1>
      {outcome === 'working' && <p role="status">Verifying your email...</p>}
      {outcome === 'done' && <p role="status">{VERIFY_SUCCESS}</p>}
      {outcome === 'failed' && <p role="alert">{VERIFY_FAILURE}</p>}
      {outcome !== 'working' && <a href="#/">Go to KWNTO</a>}
    </div>
  )
}
