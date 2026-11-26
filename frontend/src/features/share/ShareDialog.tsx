import { useEffect, useState } from 'react'
import { backend, type ShareKind, type ShareLink, type SharePermission } from '../../backend'
import { errorMessage } from '../errorMessage'
import { LinkRow } from './LinkRow'

const PERMISSIONS: { value: SharePermission; label: string }[] = [
  { value: 'view', label: 'Can view' },
  { value: 'comment', label: 'Can comment' },
  { value: 'edit', label: 'Can edit' },
]

// Share links for one project (design 5): make one, copy it, republish a snapshot, revoke.
// A snapshot can only be a view link (plan D7), so Snapshot is offered with Can view alone.
function useLinks(projectId: string) {
  const [links, setLinks] = useState<ShareLink[]>([])
  const [message, setMessage] = useState('')
  const [round, setRound] = useState(0)
  useEffect(() => {
    let cancelled = false
    backend.shares
      .list(projectId)
      .then((rows) => {
        if (!cancelled) setLinks(rows)
      })
      .catch((err: unknown) => {
        if (!cancelled) setMessage(errorMessage(err, 'Could not load the links.'))
      })
    return () => {
      cancelled = true
    }
  }, [projectId, round])

  async function run(action: () => Promise<unknown>, done: string, failed: string): Promise<void> {
    try {
      await action()
      setMessage(done)
      setRound((n) => n + 1)
    } catch (err: unknown) {
      setMessage(errorMessage(err, failed))
    }
  }
  return { links, message, run }
}

export function ShareDialog({
  projectId,
  projectName,
  onClose,
}: {
  projectId: string
  projectName: string
  onClose: () => void
}) {
  const { links, message, run } = useLinks(projectId)
  const [permission, setPermission] = useState<SharePermission>('view')
  const [kind, setKind] = useState<ShareKind>('live')
  const choose = (value: SharePermission) => {
    setPermission(value)
    if (value !== 'view') setKind('live')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${projectName}`}
        className="panel flex max-h-full w-full max-w-lg flex-col gap-3 overflow-y-auto"
      >
        <h2>{`Share ${projectName}`}</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-sm">
            Who can open it
            <select className="field" value={permission} onChange={(e) => choose(e.target.value as SharePermission)}>
              {PERMISSIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            Kind
            <select className="field" value={kind} onChange={(e) => setKind(e.target.value as ShareKind)}>
              <option value="live">Live</option>
              {permission === 'view' && <option value="snapshot">Snapshot</option>}
            </select>
          </label>
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              void run(
                () => backend.shares.create(projectId, permission, kind),
                'Link created',
                'Could not make the link.',
              )
            }
          >
            Create link
          </button>
        </div>
        <p role="status" className="min-h-5 text-sm">
          {message}
        </p>
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <LinkRow
              key={link.id}
              link={link}
              onRevoke={(l) => run(() => backend.shares.revoke(l.id), 'Revoked', 'Could not revoke the link.')}
              onRepublish={(l) =>
                run(() => backend.shares.republish(l.id), 'Republished', 'Could not republish the link.')
              }
            />
          ))}
        </ul>
        <button type="button" className="btn self-end" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
