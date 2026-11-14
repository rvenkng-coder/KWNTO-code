import { useState } from 'react'
import { useTeams } from './useTeams'

export function JoinByCodeForm() {
  const [code, setCode] = useState('')
  const notice = useTeams((s) => s.notice)

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await useTeams.getState().join(code)
    if (ok) setCode('')
  }

  return (
    <form onSubmit={handleJoin} className="panel flex max-w-sm w-full flex-col gap-2">
      <h3>Join with code</h3>
      <input
        className="field"
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        aria-label="Join code"
        placeholder="Join code"
      />
      <button type="submit" className="btn">Join</button>
      {notice && <p>{notice}</p>}
    </form>
  )
}
