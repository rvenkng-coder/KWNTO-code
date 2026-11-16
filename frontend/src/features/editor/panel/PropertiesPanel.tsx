import { trashSelection } from '../canvas/selectionActions'
import { useSelection } from '../canvas/useSelection'
import { isLiveNode } from '../model/state'
import { useEditor } from '../store/editorStore'
import { ConnectionFields } from './ConnectionFields'
import { NodeFields } from './NodeFields'

export const NOTHING_SELECTED = 'Select a node to edit it.'

function ManyNodes({ ids }: { ids: string[] }) {
  const trash = () => {
    useSelection.getState().set(ids, null)
    void trashSelection()
  }
  return (
    <div className="flex flex-col gap-2">
      <p>{ids.length} nodes selected</p>
      <button type="button" className="btn-danger self-start" onClick={trash}>Move to trash</button>
    </div>
  )
}

/** The right panel (design 6.2): what is selected on the canvas, ready to edit. */
export function PropertiesPanel() {
  const nodeIds = useSelection((s) => s.nodeIds)
  const connectionId = useSelection((s) => s.connectionId)
  const connection = useEditor((s) => (connectionId === null ? undefined : s.content.connections[connectionId]))
  const live = useEditor((s) => nodeIds.filter((id) => isLiveNode(s.content, id)).join(' '))
  const ids = live === '' ? [] : live.split(' ')
  const single = useEditor((s) => (ids.length === 1 ? s.content.nodes[ids[0] as string] : undefined))

  if (connection !== undefined) return <ConnectionFields key={connection.id} connection={connection} />
  if (ids.length > 1) return <ManyNodes ids={ids} />
  if (single !== undefined) return <NodeFields key={single.id} node={single} />
  return <p className="text-muted">{NOTHING_SELECTED}</p>
}
