import { useState } from 'react'
import { signOutQuestion } from '../editor/sync/syncText'
import { useSync } from '../editor/sync/syncStore'

export function SignOutButton({ onSignOut }: { onSignOut: () => void }) {
  const waiting = useSync((s) => s?.waiting ?? 0)
  const [asking, setAsking] = useState(false)
  return (
    <>
      <button type="button" className="btn" onClick={() => (waiting > 0 ? setAsking(true) : onSignOut())}>
        Sign out
      </button>
      {asking && waiting > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="signout-question"
            className="panel flex w-[28rem] max-w-full flex-col gap-3 shadow-lg"
          >
            <p id="signout-question">{signOutQuestion(waiting)}</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={onSignOut}>
                Sign out anyway
              </button>
              <button type="button" className="btn" onClick={() => setAsking(false)}>
                Stay signed in
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
