import { navigate } from '../../shell/useRoute'
import { useCanvasFocus } from '../canvas/useCanvasFocus'
import { useTabsView } from '../chapters/useTabsView'
import { editorStore } from '../store/editorStore'

/**
 * Opens the node's chapter (reopening a closed tab) and asks its canvas to select the node and
 * centre on it. The selection is made by that canvas, not here: a selection that points into
 * another chapter while the old canvas is still shown sends React Flow into an update loop.
 */
export function jumpToNode(nodeId: string): void {
  const node = editorStore.getState().content.nodes[nodeId]
  if (node === undefined) return
  useTabsView.getState().open(node.chapterId)
  useCanvasFocus.getState().focus(nodeId)
  navigate({ name: 'project', projectId: node.projectId, chapterId: node.chapterId })
}
