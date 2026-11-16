export const NO_START_NOTE = 'No start node: select a node and choose "Make start node".'

interface Props { showNoStart: boolean; minimapVisible: boolean; onToggleMinimap(): void }

/** Above the canvas: the minimap toggle and the no-start note ("Make start node" is in the properties panel). */
export function CanvasToolbar({ showNoStart, minimapVisible, onToggleMinimap }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3">
      <button type="button" className="btn" aria-pressed={minimapVisible} onClick={onToggleMinimap}>
        {minimapVisible ? 'Hide minimap' : 'Show minimap'}
      </button>
      {showNoStart && <p data-testid="no-start" className="text-muted">{NO_START_NOTE}</p>}
    </div>
  )
}
