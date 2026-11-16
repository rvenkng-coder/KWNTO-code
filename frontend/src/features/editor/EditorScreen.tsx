import { useEffect, useMemo } from 'react'
import type { Chapter } from '../../backend'
import { navigate } from '../shell/useRoute'
import { Canvas } from './canvas/Canvas'
import { useSelection } from './canvas/useSelection'
import { ChapterList } from './chapters/ChapterList'
import { ChapterTabs } from './chapters/ChapterTabs'
import { InlineText } from './chapters/InlineText'
import { visibleTabs } from './chapters/tabsView'
import { useTabsView } from './chapters/useTabsView'
import { ErrorBanner } from './ErrorBanner'
import { liveChapters } from './model/state'
import { PropertiesPanel } from './panel/PropertiesPanel'
import { editorStore, useEditor } from './store/editorStore'
import { pendingEdits, shouldWarnOnLeave } from './store/pendingEdits'

const NOT_FOUND = 'This project does not exist or you are not a member of its team.'

function NotFound() {
  return (
    <div className="panel flex flex-col gap-3">
      <p>{NOT_FOUND}</p>
      <button type="button" className="btn self-start" onClick={() => navigate({ name: 'teams' })}>Back to teams</button>
    </div>
  )
}

// Opens the project while the screen is shown; the tab view starts fresh for each project.
function useOpenProject(projectId: string): void {
  useEffect(() => {
    useTabsView.getState().reset()
    void editorStore.getState().open(projectId)
    return () => void editorStore.getState().close()
  }, [projectId])
}

// Text still waiting to be saved goes now when the person moves on (Review Focus 3): another
// selection, chapter or project, leaving the editor or the page. Leaving the page while a save
// is unsent or in flight asks the browser to warn.
function useFlushOnLeave(projectId: string, chapterId: string | null): void {
  const nodeIds = useSelection((s) => s.nodeIds)
  const connectionId = useSelection((s) => s.connectionId)
  useEffect(() => () => pendingEdits.flushAll(), [projectId, chapterId, nodeIds, connectionId])
  useEffect(() => {
    const onPageHide = () => pendingEdits.flushAll()
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      pendingEdits.flushAll()
      if (shouldWarnOnLeave(pendingEdits.size(), editorStore.getState().saving)) e.preventDefault()
    }
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])
}

// A route without a chapter, or with a chapter that is gone, shows the first open tab.
function useFirstTabRedirect(projectId: string, chapters: Chapter[], active: Chapter | null): void {
  const status = useEditor((s) => s.status)
  const view = useTabsView((s) => s.view)
  const first = visibleTabs(chapters, view)[0]
  useEffect(() => {
    if (status === 'ready' && active === null && first !== undefined) {
      navigate({ name: 'project', projectId, chapterId: first.id })
    }
  }, [status, active, first, projectId])
}

interface FrameProps { projectId: string; projectName: string; chapters: Chapter[]; active: Chapter | null }

function EditorFrame({ projectId, projectName, chapters, active }: FrameProps) {
  const activeId = active === null ? null : active.id
  return (
    <div className="flex flex-col gap-3">
      <ErrorBanner />
      <div className="grid grid-cols-[14rem_1fr_16rem] gap-3">
        <aside data-testid="editor-left" className="panel flex flex-col gap-3">
          <button type="button" className="btn self-start" onClick={() => navigate({ name: 'teams' })}>Back to teams</button>
          <InlineText
            value={projectName}
            label="Project name"
            className="text-left text-lg font-semibold"
            onCommit={(name) => void editorStore.getState().update('projects', projectId, { name })}
          />
          <ChapterList projectId={projectId} chapters={chapters} activeId={activeId} />
        </aside>
        <section data-testid="editor-canvas" className="panel flex min-w-0 flex-col gap-2 p-0">
          <ChapterTabs projectId={projectId} chapters={chapters} activeId={activeId} />
          {active === null
            ? <p className="p-3 text-muted">Open a chapter from the list.</p>
            : <Canvas projectId={projectId} chapterId={active.id} />}
        </section>
        <aside data-testid="editor-panel" className="panel min-w-0">
          <PropertiesPanel />
        </aside>
      </div>
    </div>
  )
}

/** The editor (design 6.6): left panel, centre (tabs and the canvas), right panel. */
export function EditorScreen({ projectId, chapterId }: { projectId: string; chapterId: string | null }) {
  const status = useEditor((s) => s.status)
  const content = useEditor((s) => s.content)
  const chapters = useMemo(() => liveChapters(content), [content])
  const active = chapters.find((c) => c.id === chapterId) ?? null
  useOpenProject(projectId)
  useFirstTabRedirect(projectId, chapters, active)
  useFlushOnLeave(projectId, chapterId)

  if (status === 'error') return <NotFound />
  if (status !== 'ready') return <p>Loading project…</p>
  const projectName = content.project === null ? '' : content.project.name
  return <EditorFrame projectId={projectId} projectName={projectName} chapters={chapters} active={active} />
}
