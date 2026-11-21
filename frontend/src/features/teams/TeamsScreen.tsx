import { useEffect } from 'react'
import { useSession } from '../auth/useSession'
import { navigate } from '../shell/useRoute'
import { useTeams } from './useTeams'
import { JoinByCodeForm } from './JoinByCodeForm'
import { InvitesInbox } from './InvitesInbox'
import { VerifyGate } from '../auth/VerifyGate'
import { SharedWithMe } from '../share/SharedWithMe'
import { askText } from '../shell/dialogs'

export function TeamsScreen() {
  const { user } = useSession()
  const { teams, error, list } = useTeams()

  useEffect(() => {
    list()
  }, [list])

  // Signing out unmounts this screen: forget the teams, so the next account on this
  // browser never sees them, even briefly.
  useEffect(() => () => useTeams.setState({ teams: [], error: null }), [])

  if (!user) return null

  return (
    <div className="flex flex-col gap-3">
      <h2>Teams</h2>
      {error && <p data-testid="form-error" role="alert">{error}</p>}
      {!user.verified && <VerifyGate email={user.email} />}
      <button
        className="btn-primary self-start"
        onClick={() => {
          if (user.verified) void askText('Team name').then((name) => (name === null ? undefined : useTeams.getState().create(name)))
        }}
        disabled={!user.verified}
      >
        Create team
      </button>
      <InvitesInbox onAccepted={list} />
      <JoinByCodeForm />
      <ul data-testid="team-list" className="panel flex flex-col gap-1">
        {teams.map((team) => (
          <li key={team.id}>
            <button type="button" className="link-button" onClick={() => navigate({ name: 'team', teamId: team.id })}>
              {team.name}
            </button>
          </li>
        ))}
      </ul>
      <SharedWithMe />
    </div>
  )
}
