import { useEffect, useState } from 'react'
import { useSession } from '../auth/useSession'
import { useTeams } from './useTeams'
import { JoinDialog } from './JoinDialog'
import { InvitesInbox } from './InvitesInbox'
import { TeamCard } from './TeamCard'
import { VerifyGate } from '../auth/VerifyGate'
import { SharedWithMe } from '../share/SharedWithMe'
import { askText } from '../shell/dialogs'

export function TeamsScreen() {
  const { user } = useSession()
  const { teams, error, notice, list } = useTeams()
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    list()
  }, [list])

  // Signing out unmounts this screen: forget the teams, so the next account on this
  // browser never sees them, even briefly.
  useEffect(() => () => useTeams.setState({ teams: [], error: null, notice: null }), [])

  if (!user) return null
  const create = () => {
    if (user.verified)
      void askText('Team name').then((name) => (name === null ? undefined : useTeams.getState().create(name)))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-2xl">Teams</h2>
        <button type="button" className="btn" disabled={!user.verified} onClick={() => setJoining(true)}>
          Join with code
        </button>
        <button type="button" className="btn-primary" onClick={create} disabled={!user.verified}>
          Create team
        </button>
      </div>
      {error && (
        <p data-testid="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!user.verified && <VerifyGate email={user.email} />}
      <InvitesInbox onAccepted={list} />
      <section className="flex flex-col gap-2">
        <h3 className="section-label">Your teams</h3>
        {/* Always in the page, so "no team is listed" is something a test (and a screen reader) can look at. */}
        <div data-testid="team-list">
          {teams.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-border p-8 text-center">
              <p className="font-semibold">You are not in a team yet</p>
              <p className="text-muted">
                Use the buttons above to create a team, or to join one with a code from a teammate.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(18rem,1fr))]">
              {teams.map((team) => (
                <TeamCard key={team.id} team={team} />
              ))}
            </ul>
          )}
        </div>
      </section>
      <SharedWithMe />
      {joining && <JoinDialog onClose={() => setJoining(false)} />}
    </div>
  )
}
