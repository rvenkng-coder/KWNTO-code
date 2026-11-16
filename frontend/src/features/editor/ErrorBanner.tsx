import { editorStore, useEditor } from './store/editorStore'

/** The last failed save, with a Dismiss button. Shows nothing when there is no error. */
export function ErrorBanner() {
  const error = useEditor((s) => s.error)
  if (error === null) return null
  return (
    <div role="alert" className="panel flex items-center justify-between gap-3">
      <span>{error}</span>
      <button type="button" className="btn" onClick={() => editorStore.getState().dismissError()}>Dismiss</button>
    </div>
  )
}
