import { useId, useState, type ChangeEvent } from 'react'
import { backend } from '../../backend'
import { errorMessage } from '../errorMessage'
import { navigate } from '../shell/useRoute'

/** Makes a new project in the team from a project file (design 10); the server checks the file and says why it refuses one. */
export function ImportProject({ teamId }: { teamId: string }) {
  const inputId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function choose(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const file = input.files?.[0]
    if (file === undefined) return
    setBusy(true)
    setError(null)
    try {
      const projectId = await backend.projectFiles.importFile(teamId, file)
      navigate({ name: 'project', projectId, chapterId: null })
    } catch (err: unknown) {
      setError(errorMessage(err, 'Could not import the file.'))
      setBusy(false)
    }
    // So the same file can be chosen again after a refusal.
    input.value = ''
  }

  return (
    <div
      data-testid="import-project"
      className="flex flex-col justify-center gap-2 rounded-[var(--radius)] border border-dashed border-border p-3"
    >
      <h4 className="font-semibold">Import project</h4>
      <p className="text-sm text-muted">
        Start a new project in this team from a project file (.json) exported from KWNTO.
      </p>
      <input
        id={inputId}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        disabled={busy}
        onChange={(e) => void choose(e)}
      />
      <label htmlFor={inputId} className={`btn self-start ${busy ? 'opacity-50' : 'cursor-pointer'}`}>
        Choose project file…
      </label>
      {busy && <p>Importing…</p>}
      {error !== null && <p role="alert">{error}</p>}
    </div>
  )
}
