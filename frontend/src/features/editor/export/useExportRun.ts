import { useCallback, useEffect, useRef, useState } from 'react'
import type { Chapter } from '../../../backend'
import { editorStore } from '../store/editorStore'
import { buildDocx, buildPdf, dataUrlBytes } from './documents'
import { downloadBlob } from './download'
import { exportChapters, exportFileName, type ExportFormat, type ExportScope, type MapImage } from './exportPlan'
import type { StageKind } from './ExportStage'

export const FAILED = 'The export failed. Try again, or export one chapter at a time.'
export const SMALL = 'Some maps were large, so their labels may be small in the export.'

/** How long one chapter's picture may take before the run is given up (a stuck stage must not trap the dialog). */
export const STAGE_TIMEOUT_MS = 30_000

export type RunStatus = 'idle' | 'working' | 'error' | 'note'
interface Run {
  format: ExportFormat
  scope: ExportScope
  chapters: Chapter[]
  skipped: number
  images: MapImage[]
}

function skippedNote(count: number): string {
  return `${count} empty ${count === 1 ? 'chapter was' : 'chapters were'} skipped.`
}

async function buildFile(projectName: string, format: ExportFormat, images: MapImage[]): Promise<Blob> {
  const first = images[0]
  if (first === undefined) throw new Error('Nothing to export.')
  if (format === 'pdf') return buildPdf(projectName, images)
  if (format === 'docx') return buildDocx(projectName, images)
  return new Blob([dataUrlBytes(first.dataUrl)], { type: format === 'jpg' ? 'image/jpeg' : 'image/png' })
}

/** One export: draws the chapters one at a time on the stage, then builds and downloads the file. It only reads the store (D8). */
export function useExportRun(projectName: string, activeChapterId: string | null) {
  const [status, setStatus] = useState<RunStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [stage, setStage] = useState<{ chapterId: string; kind: StageKind } | null>(null)
  const run = useRef<Run | null>(null)

  const fail = useCallback((text: string) => {
    run.current = null
    setStage(null)
    setStatus('error')
    setMessage(text)
  }, [])

  const start = useCallback(
    (format: ExportFormat, scope: ExportScope) => {
      const plan = exportChapters(editorStore.getState().content, scope, activeChapterId)
      if (!plan.ok) return fail(plan.message)
      const first = plan.chapters[0]
      if (first === undefined) return fail(FAILED)
      run.current = { format, scope, chapters: plan.chapters, skipped: plan.skipped, images: [] }
      setStatus('working')
      setMessage(null)
      setStage({ chapterId: first.id, kind: format === 'jpg' ? 'jpeg' : 'png' })
    },
    [activeChapterId, fail],
  )

  const finish = useCallback(
    async (r: Run) => {
      const only = r.chapters[0]
      const name = exportFileName(
        projectName,
        r.scope === 'chapter' && only !== undefined ? only.title : null,
        r.format,
      )
      downloadBlob(name, await buildFile(projectName, r.format, r.images))
      run.current = null
      setStage(null)
      const notes = [
        r.skipped > 0 ? skippedNote(r.skipped) : null,
        r.images.some((i) => i.small) ? SMALL : null,
      ].filter((n) => n !== null)
      if (notes.length > 0) {
        setStatus('note')
        setMessage(notes.join(' '))
      } else setStatus('idle')
    },
    [projectName],
  )

  const onImage = useCallback(
    (img: MapImage) => {
      const r = run.current
      if (r === null) return
      r.images.push(img)
      const next = r.chapters[r.images.length]
      if (next !== undefined) return setStage({ chapterId: next.id, kind: r.format === 'jpg' ? 'jpeg' : 'png' })
      finish(r).catch(() => fail(FAILED))
    },
    [finish, fail],
  )

  const onError = useCallback(() => fail(FAILED), [fail])
  useEffect(() => {
    if (stage === null) return
    const timer = setTimeout(() => fail(FAILED), STAGE_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [stage, fail])
  return { status, message, stage, start, onImage, onError }
}
