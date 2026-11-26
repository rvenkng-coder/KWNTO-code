import { useState } from 'react'
import { backend } from '../../backend'
import { errorMessage } from '../errorMessage'

// Gives the browser the file as a download through a temporary object URL, which is revoked
// shortly after the click (the download has started by then).
function saveBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Downloads the project as a JSON file (design 10). The server builds the file. */
export function ExportButton({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    setBusy(true)
    setError(null)
    try {
      const { name, blob } = await backend.projectFiles.download(projectId)
      saveBlob(name, blob)
    } catch (err: unknown) {
      setError(errorMessage(err, 'Could not export the project.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" className="btn self-start" disabled={busy} onClick={() => void download()}>
        Export project file
      </button>
      {error !== null && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
    </div>
  )
}
