import { useState } from 'react'
import { useTeams } from './useTeams'

export function JoinByCodeForm() {
  const [code, setCode] = useState('')
  const [joined, setJoined] = useState(false)

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await useTeams.getState().join(code)
    setJoined(ok)
    if (ok) setCode('')
  }

  return (
    <form onSubmit={handleJoin}>
      <h3>Join with code</h3>
      <input
        type="text"
        value={code}
        onChange={(e) => {
          setCode(e.target.value)
          setJoined(false)
        }}
        aria-label="Join code"
        placeholder="Join code"
      />
      <button type="submit">Join</button>
      {joined && <p>Joined successfully!</p>}
    </form>
  )
}
