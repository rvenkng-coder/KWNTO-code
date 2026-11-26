import { SearchBox } from '../search/SearchBox'
import { useEditor } from '../store/editorStore'
import { ToolStrip } from './ToolStrip'
import type { ViewPrefs } from './useViewPrefs'

export const NO_START_NOTE = 'No start node: select a node and choose "Make start node".'

interface Props {
  chapterId: string
  showNoStart: boolean
  prefs: ViewPrefs
}

/** Above the canvas: the tools (Undo and Redo among them, the minimap toggle last), search and the no-start note ("Make start node" is in the properties panel). */
export function CanvasToolbar({ chapterId, showNoStart, prefs }: Props) {
  const projectName = useEditor((s) => s.content.project?.name ?? '')
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 pt-2">
      <ToolStrip chapterId={chapterId} projectName={projectName} view={prefs} />
      <div className="ml-auto min-w-48 flex-1 sm:max-w-sm">
        <SearchBox />
      </div>
      {showNoStart && (
        <p data-testid="no-start" className="w-full text-muted">
          {NO_START_NOTE}
        </p>
      )}
    </div>
  )
}
