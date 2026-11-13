import { useEffect, useState } from 'react'
import { useSession } from '../auth/useSession'
import { useTeams } from './useTeams'
import { TeamDetail } from './TeamDetail'
import { JoinByCodeForm } from './JoinByCodeForm'
import { InvitesInbox } from './InvitesInbox'

export function TeamsScreen() {
  const { user, signOut } = useSession()
  const { teams, error, list } = useTeams()
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)


  useEffect(() => {
    list()
  }, [list])

  // Signing out unmounts this screen: forget the teams, so the next account on this
  // browser never sees them, even briefly.
  useEffect(() => () => useTeams.setState({ teams: [], error: null }), [])

  if (!user) return null

  if (selectedTeam) {
    return <TeamDetail
        teamId={selectedTeam}
        onBack={() => {
          setSelectedTeam(null)
          list()
        }}
      />
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Teams</h2>
        <div>
          <span data-testid="session-user">{user.name}</span>{' '}
          <button onClick={signOut}>Sign out</button>
        </div>
      </div>
      {error && <p data-testid="form-error" role="alert">{error}</p>}
      {!user.verified && (
        <p className="gate">Verify your email to create or join a team.</p>
      )}
      <button
        onClick={() => {
          if (user.verified) {
            const name = prompt('Team name:')
            if (name) void useTeams.getState().create(name)
          }
        }}
        disabled={!user.verified}
      >
        Create team
      </button>
      <InvitesInbox onAccepted={list} />
      <JoinByCodeForm />
      <ul data-testid="team-list">
        {teams.map((team) => (
          <li key={team.id}>
            <button type="button" onClick={() => setSelectedTeam(team.id)}>
              {team.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
