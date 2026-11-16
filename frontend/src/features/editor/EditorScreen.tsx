import { useEffect, useMemo } from 'react'
import { navigate } from '../shell/useRoute'
import { ChapterList } from './chapters/ChapterList'
import { ChapterTabs } from './chapters/ChapterTabs'
import { InlineText } from './chapters/InlineText'
import { visibleTabs } from './chapters/tabsView'
import { useTabsView } from './chapters/useTabsView'
import { ErrorBanner } from './ErrorBanner'
import { liveChapters } from './model/state'
import { editorStore, useEditor } from './store/editorStore'

const NOT_FOUND = 'This project does not exist or you are not a member of its team.'

function NotFound() {
  return (
    <div className="panel flex flex-col gap-3">
      <p>{NOT_FOUND}</p>
      <button type="button" className="btn self-start" onClick={() => navigate({ name: 'teams' })}>Back to teams</button>
    </div>
  )
}

/** The editor frame (design 6.6): left panel, centre (tabs and the canvas), right panel. */
export function EditorScreen({ projectId, chapterId }: { projectId: string; chapterId: string | null }) {
  const status = useEditor((s) => s.status)
  const content = useEditor((s) => s.content)
  const view = useTabsView((s) => s.view)
  const chapters = useMemo(() => liveChapters(content), [content])

  useEffect(() => {
    useTabsView.getState().reset()
    void editorStore.getState().open(projectId)
    return () => void editorStore.getState().close()
  }, [projectId])

  // A route without a chapter, or with a chapter that is gone, shows the first open tab.
  const active = chapters.find((c) => c.id === chapterId) ?? null
  const first = visibleTabs(chapters, view)[0]
  useEffect(() => {
    if (status === 'ready' && active === null && first !== undefined) {
      navigate({ name: 'project', projectId, chapterId: first.id })
    }
  }, [status, active, first, projectId])

  if (status === 'error') return <NotFound />
  if (status !== 'ready') return <p>Loading project…</p>

  return (
    <div className="flex flex-col gap-3">
      <ErrorBanner />
      <div className="grid grid-cols-[14rem_1fr_16rem] gap-3">
        <aside data-testid="editor-left" className="panel flex flex-col gap-3">
          <button type="button" className="btn self-start" onClick={() => navigate({ name: 'teams' })}>Back to teams</button>
          <InlineText
            value={content.project?.name ?? ''}
            label="Project name"
            className="text-left text-lg font-semibold"
            onCommit={(name) => void editorStore.getState().update('projects', projectId, { name })}
          />
          <ChapterList projectId={projectId} chapters={chapters} activeId={active?.id ?? null} />
        </aside>
        <section data-testid="editor-canvas" className="panel flex flex-col gap-2 p-0">
          <ChapterTabs projectId={projectId} chapters={chapters} activeId={active?.id ?? null} />
          <p className="p-3 text-muted">{active === null ? 'Open a chapter from the list.' : `${active.title}: the canvas arrives in Task 10.`}</p>
        </section>
        <aside data-testid="editor-panel" className="panel">
          <p className="text-muted">Properties arrive in Task 11.</p>
        </aside>
      </div>
    </div>
  )
}
