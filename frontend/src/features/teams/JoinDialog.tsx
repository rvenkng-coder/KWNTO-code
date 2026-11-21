import { useEffect, useId, useState } from 'react'
import { useSession } from '../auth/useSession'
import { useTeams } from './useTeams'

/** "Join with code": opens a small dialog with the code field; closes when the code is sent (Escape or Cancel closes it too). */
export function JoinDialog({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('')
  const { user } = useSession()
  const titleId = useId()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    // Closes either way: the result (a notice, or the error) shows on the Teams screen behind it.
    await useTeams.getState().join(code)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={(e) => void handleJoin(e)} onClick={(e) => e.stopPropagation()}
        className="panel flex w-full max-w-sm flex-col gap-3 shadow-lg">
        <h3 id={titleId}>Join with code</h3>
        <input className="field w-full" type="text" autoFocus value={code} onChange={(e) => setCode(e.target.value)} aria-label="Join code" placeholder="Join code" />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!user?.verified}>Join</button>
        </div>
      </form>
    </div>
  )
}
