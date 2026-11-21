import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExportChoices } from './ExportChoices'
import { ExportStage } from './ExportStage'
import { scopesFor, type ExportFormat, type ExportScope } from './exportPlan'
import { useExportRun } from './useExportRun'
import { useFocusGuard, useModalKeys } from './useModalKeys'

/** The Export map dialog (design 6.5): pick a format and what to export, then download. Modal; Escape closes it unless an export is running. */
export function ExportDialog({ projectName, chapterId, onClose }: { projectName: string; chapterId: string | null; onClose(): void }) {
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [scope, setScope] = useState<ExportScope>('chapter')
  const run = useExportRun(projectName, chapterId)
  const working = run.status === 'working'
  const done = run.status === 'note'
  const wasWorking = useRef(false)
  const opener = useRef<Element | null>(document.activeElement)
  const box = useRef<HTMLDivElement | null>(null)
  const onKeyDown = useModalKeys(box, working, onClose)
  useFocusGuard(box)

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
  // Disabled controls drop focus; keep it inside the dialog so the keys still reach it.
  useEffect(() => {
    if (working) box.current?.focus()
  }, [working])

  const pick = (next: ExportFormat) => {
    setFormat(next)
    if (!scopesFor(next).includes(scope)) setScope('chapter')
  }
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div ref={box} tabIndex={-1} onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-labelledby="export-heading"
        className="panel flex w-[26rem] max-w-full flex-col gap-3 shadow-lg outline-none">
        <h2 id="export-heading" className="text-lg font-semibold">Export map</h2>
        <ExportChoices format={format} scope={scope} disabled={working || done} onFormat={pick} onScope={setScope} />
        {working && <p role="status">Exporting…</p>}
        {run.status === 'error' && <p role="alert" className="text-danger">{run.message}</p>}
        {done && <p role="status">{run.message}</p>}
        <div className="flex justify-end gap-2">
          {done
            ? <button type="button" className="btn-primary" autoFocus onClick={onClose}>Close</button>
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
