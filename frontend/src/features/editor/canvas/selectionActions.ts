import { liveNodes } from '../model/state'
import { editorStore } from '../store/editorStore'
import { edits } from '../store/edits'
import { useSelection } from './useSelection'

// What the Delete key, the panel and the shortcuts do with the selection (design 6.1, D12).

export const plural = (n: number, what: string) => (n === 1 ? `1 ${what}` : `${n} ${what}s`)

/** Trashes the selected nodes as one step (their connections stay for undo), or deletes the selected connection. */
export async function trashSelection(): Promise<void> {
  const { nodeIds, connectionId } = useSelection.getState()
  useSelection.getState().set([], null)
  if (nodeIds.length === 0) {
    if (connectionId !== null) await edits.remove('connections', connectionId, 'Delete connection')
    return
  }
  const label = `Move ${plural(nodeIds.length, 'node')} to trash`
  await edits.group(label, async () => {
    await Promise.all(nodeIds.map((id) => edits.update('nodes', id, { deleted: true }, label)))
  })
}

/** Copies the selected nodes, then trashes them as one step labelled Cut. */
export async function cutSelection(): Promise<void> {
  const { nodeIds } = useSelection.getState()
  if (nodeIds.length === 0) return
  useSelection.getState().set([], null)
  await edits.cut(nodeIds)
}

/** Selects every live node of the chapter. */
export function selectAll(chapterId: string): void {
  useSelection.getState().set(liveNodes(editorStore.getState().content, chapterId).map((n) => n.id), null)
}
