import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExportStage } from './ExportStage'
import { scopesFor, type ExportFormat, type ExportScope } from './exportPlan'
import { useExportRun } from './useExportRun'

const FORMATS: Array<{ value: ExportFormat; label: string }> = [
  { value: 'pdf', label: 'PDF' }, { value: 'docx', label: 'Word' }, { value: 'jpg', label: 'JPG' }, { value: 'png', label: 'PNG' },
]
const SCOPES: Array<{ value: ExportScope; label: string }> = [
  { value: 'chapter', label: 'Current chapter' }, { value: 'project', label: 'Whole project' },
]

/** The Export map dialog (design 6.5): pick a format and what to export, then download. Modal; Escape closes it unless an export is running. */
export function ExportDialog({ projectName, chapterId, onClose }: { projectName: string; chapterId: string | null; onClose(): void }) {
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [scope, setScope] = useState<ExportScope>('chapter')
  const run = useExportRun(projectName, chapterId)
  const working = run.status === 'working'
  const wasWorking = useRef(false)
  const formatRefs = useRef(new Map<ExportFormat, HTMLInputElement>())
  const opener = useRef<Element | null>(document.activeElement)

  useEffect(() => formatRefs.current.get('pdf')?.focus(), [])
  useEffect(() => {
    const back = opener.current
    return () => {
      if (back instanceof HTMLElement) back.focus()
    }
  }, [])
  useEffect(() => {
    if (wasWorking.current && run.status === 'idle') onClose()
    wasWorking.current = working
  }, [run.status, working, onClose])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !working) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [working, onClose])

  const pick = (next: ExportFormat) => {
    setFormat(next)
    if (!scopesFor(next).includes(scope)) setScope('chapter')
  }
  const allowed = scopesFor(format)
  const done = run.status === 'small'
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div role="dialog" aria-modal="true" aria-labelledby="export-heading" className="panel flex w-[26rem] max-w-full flex-col gap-3 shadow-lg">
        <h2 id="export-heading" className="text-lg font-semibold">Export map</h2>
        <fieldset className="flex flex-col gap-1" disabled={working || done}>
          <legend className="mb-1 font-medium">Format</legend>
          {FORMATS.map((f) => (
            <label key={f.value} className="flex items-center gap-2">
              <input type="radio" name="export-format" checked={format === f.value} onChange={() => pick(f.value)}
                ref={(el) => {
                  if (el === null) formatRefs.current.delete(f.value)
                  else formatRefs.current.set(f.value, el)
                }} />
              {f.label}
            </label>
          ))}
        </fieldset>
        <fieldset className="flex flex-col gap-1" disabled={working || done}>
          <legend className="mb-1 font-medium">What to export</legend>
          {SCOPES.map((s) => (
            <label key={s.value} className="flex items-center gap-2">
              <input type="radio" name="export-scope" checked={scope === s.value} disabled={!allowed.includes(s.value)} onChange={() => setScope(s.value)} />
              {s.label}
            </label>
          ))}
          {allowed.length === 1 && <p className="text-sm text-muted">Images export the current chapter only.</p>}
        </fieldset>
        {working && <p role="status">Exporting…</p>}
        {run.status === 'error' && <p role="alert" className="text-danger">{run.message}</p>}
        {done && <p role="status">{run.message}</p>}
        <div className="flex justify-end gap-2">
          {done
            ? <button type="button" className="btn-primary" onClick={onClose}>Close</button>
            : (
              <>
                <button type="button" className="btn" disabled={working} onClick={onClose}>Cancel</button>
                <button type="button" className="btn-primary" disabled={working} onClick={() => run.start(format, scope)}>Export</button>
              </>
            )}
        </div>
      </div>
      {run.stage !== null && <ExportStage key={run.stage.chapterId} chapterId={run.stage.chapterId} kind={run.stage.kind} onImage={run.onImage} onError={run.onError} />}
    </div>,
    document.body,
  )
}
