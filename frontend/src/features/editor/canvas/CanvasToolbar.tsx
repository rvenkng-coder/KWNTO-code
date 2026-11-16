import { editorStore } from '../store/editorStore'
import { useSelection } from './useSelection'

export const NO_START_NOTE = 'No start node: select a node and choose "Make start node".'

interface Props { projectId: string; showNoStart: boolean; minimapVisible: boolean; onToggleMinimap(): void }

/** Above the canvas: make the selected node the start node, the minimap toggle and the no-start note. */
export function CanvasToolbar({ projectId, showNoStart, minimapVisible, onToggleMinimap }: Props) {
  const nodeIds = useSelection((s) => s.nodeIds)
  const makeStart = () => void editorStore.getState().update('projects', projectId, { startNodeId: nodeIds[0] })
  return (
    <div className="flex flex-wrap items-center gap-2 px-3">
      {nodeIds.length === 1 && <button type="button" className="btn" onClick={makeStart}>Make start node</button>}
      <button type="button" className="btn" aria-pressed={minimapVisible} onClick={onToggleMinimap}>
        {minimapVisible ? 'Hide minimap' : 'Show minimap'}
      </button>
      {showNoStart && <p data-testid="no-start" className="text-muted">{NO_START_NOTE}</p>}
    </div>
  )
}
