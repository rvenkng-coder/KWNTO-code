import { useState, type PointerEvent } from 'react'
import type { Chapter } from '../../../backend'
import { navigate } from '../../shell/useRoute'
import { ToolButton } from '../canvas/ToolButton'
import { useLeftPanel } from '../useLeftPanel'
import { AllChaptersMenu } from './AllChaptersMenu'
import { addChapter, renameChapter } from './chapterActions'
import { InlineText } from './InlineText'
import { TabMenu } from './TabMenu'
import { activeAfterClose, TAB_DEFAULT, visibleTabs } from './tabsView'
import { useTabsView } from './useTabsView'

interface ChapterTabsProps { projectId: string; chapters: Chapter[]; activeId: string | null }

// Drag the right edge of a tab to set its width (D10); the width is kept in memory only.
function ResizeHandle({ id, width }: { id: string; width: number }) {
  const setWidth = useTabsView((s) => s.setWidth)
  const [start, setStart] = useState<{ x: number; width: number } | null>(null)
  return (
    <span
      role="separator"
      aria-label="Resize tab"
      className="w-1 cursor-col-resize self-stretch bg-border"
      onPointerDown={(e: PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        setStart({ x: e.clientX, width })
      }}
      onPointerMove={(e: PointerEvent) => {
        if (start !== null) setWidth(id, start.width + e.clientX - start.x)
      }}
      onPointerUp={() => setStart(null)}
    />
  )
}

// The chapter bar (draw.io-style page tabs): "≡" lists every chapter, then the tabs (title,
// ▾ menu, ×, resize handle), then "+". Only the tabs scroll; the menus are drawn in their own
// layer, so the scrolling strip cannot clip them.
export function ChapterTabs({ projectId, chapters, activeId }: ChapterTabsProps) {
  const { view, close, open } = useTabsView()
  const panelShown = useLeftPanel((s) => s.shown)
  const [renaming, setRenaming] = useState<string | null>(null)
  const tabs = visibleTabs(chapters, view)
  const go = (id: string | null) => navigate({ name: 'project', projectId, chapterId: id })
  const show = (id: string) => {
    open(id)
    go(id)
  }
  // The open chapter's tab is leaving (closed or trashed): show its neighbour.
  const leave = (id: string) => {
    const next = activeAfterClose(tabs, id, activeId)
    if (next !== activeId) go(next)
  }
  return (
    <div className="flex border-b border-border">
      <ToolButton icon="panel" name={panelShown ? 'Hide project panel' : 'Show project panel'} onClick={() => useLeftPanel.getState().toggle()} />
      <AllChaptersMenu chapters={chapters} activeId={activeId} onShow={show} />
      <div role="tablist" className="flex min-w-0 overflow-x-auto">
        {tabs.map((c) => {
          const width = view.widths[c.id] ?? TAB_DEFAULT
          return (
            <div
              key={c.id}
              className={`flex shrink-0 items-center gap-1 border-r border-border px-2 py-1 [&>input]:min-w-0 [&>input]:flex-1 ${c.id === activeId ? 'bg-panel font-semibold' : 'bg-bg'}`}
              style={{ width }}
            >
              <InlineText
                value={c.title}
                label="Chapter title"
                role="tab"
                selected={c.id === activeId}
                className="flex-1 truncate text-left"
                onClick={() => go(c.id)}
                onCommit={(title) => void renameChapter(c.id, title)}
                editing={renaming === c.id}
                onEditingChange={(editing) => setRenaming(editing ? c.id : null)}
              />
              <TabMenu chapter={c} ordered={chapters} onRename={() => setRenaming(c.id)} onTrash={() => leave(c.id)} />
              <button
                type="button"
                className="px-1"
                aria-label={`Close ${c.title}`}
                onClick={() => {
                  leave(c.id)
                  close(c.id)
                }}
              >
                ×
              </button>
              <ResizeHandle id={c.id} width={width} />
            </div>
          )
        })}
      </div>
      <button
        type="button"
        className="shrink-0 px-2"
        aria-label="Add chapter"
        onClick={() => void addChapter(projectId, chapters).then(show)}
      >
        +
      </button>
    </div>
  )
}
