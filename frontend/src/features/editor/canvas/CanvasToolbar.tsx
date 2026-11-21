import { SearchBox } from '../search/SearchBox'
import { useEditor } from '../store/editorStore'
import { edits } from '../store/edits'
import { ToolStrip } from './ToolStrip'

export const NO_START_NOTE = 'No start node: select a node and choose "Make start node".'

interface Props { chapterId: string; showNoStart: boolean; minimapVisible: boolean; onToggleMinimap(): void }

/** Above the canvas: Undo and Redo, the minimap toggle, the tools, search and the no-start note ("Make start node" is in the properties panel). */
export function CanvasToolbar({ chapterId, showNoStart, minimapVisible, onToggleMinimap }: Props) {
  const projectName = useEditor((s) => s.content.project?.name ?? '')
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 pt-2">
      <button type="button" className="btn" onClick={() => void edits.undo()}>Undo</button>
      <button type="button" className="btn" onClick={() => void edits.redo()}>Redo</button>
      <button type="button" className="btn" aria-pressed={minimapVisible} onClick={onToggleMinimap}>
        {minimapVisible ? 'Hide minimap' : 'Show minimap'}
      </button>
      <ToolStrip chapterId={chapterId} projectName={projectName} />
      <div className="ml-auto min-w-48 flex-1 sm:max-w-sm"><SearchBox /></div>
      {showNoStart && <p data-testid="no-start" className="w-full text-muted">{NO_START_NOTE}</p>}
    </div>
  )
}
