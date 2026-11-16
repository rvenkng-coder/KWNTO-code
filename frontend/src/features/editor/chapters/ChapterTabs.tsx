import { useState, type PointerEvent } from 'react'
import type { Chapter } from '../../../backend'
import { navigate } from '../../shell/useRoute'
import { shiftChapter } from './chapterActions'
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

function TabMenu({ chapter, ordered }: { chapter: Chapter; ordered: Chapter[] }) {
  const [open, setOpen] = useState(false)
  const at = ordered.findIndex((c) => c.id === chapter.id)
  const item = (label: string, direction: 'left' | 'right', disabled: boolean) => (
    <button
      type="button"
      role="menuitem"
      className="btn"
      disabled={disabled}
      onClick={() => {
        setOpen(false)
        void shiftChapter(ordered, chapter.id, direction)
      }}
    >
      {label}
    </button>
  )
  return (
    <span className="relative">
      <button type="button" className="px-1" aria-haspopup="menu" aria-expanded={open} aria-label={`Menu for ${chapter.title}`} onClick={() => setOpen(!open)}>⋯</button>
      {open && (
        <div role="menu" className="panel absolute right-0 z-10 flex flex-col gap-1">
          {item('Move left', 'left', at <= 0)}
          {item('Move right', 'right', at === ordered.length - 1)}
        </div>
      )}
    </span>
  )
}

export function ChapterTabs({ projectId, chapters, activeId }: ChapterTabsProps) {
  const { view, close } = useTabsView()
  const tabs = visibleTabs(chapters, view)
  const go = (id: string | null) => navigate({ name: 'project', projectId, chapterId: id })
  return (
    <div role="tablist" className="flex overflow-x-auto border-b border-border">
      {tabs.map((c) => {
        const width = view.widths[c.id] ?? TAB_DEFAULT
        return (
          <div
            key={c.id}
            className={`flex shrink-0 items-center gap-1 border-r border-border px-2 py-1 ${c.id === activeId ? 'bg-panel font-semibold' : 'bg-bg'}`}
            style={{ width }}
          >
            <button type="button" role="tab" aria-selected={c.id === activeId} className="flex-1 truncate text-left" onClick={() => go(c.id)}>
              {c.title}
            </button>
            <TabMenu chapter={c} ordered={chapters} />
            <button
              type="button"
              className="px-1"
              aria-label={`Close ${c.title}`}
              onClick={() => {
                const next = activeAfterClose(tabs, c.id, activeId)
                close(c.id)
                if (next !== activeId) go(next)
              }}
            >
              ×
            </button>
            <ResizeHandle id={c.id} width={width} />
          </div>
        )
      })}
    </div>
  )
}
