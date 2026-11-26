import { useReactFlow, useStoreApi } from '@xyflow/react'
import { useEffect, type RefObject } from 'react'
import { liveNodes } from '../model/state'
import { editorStore } from '../store/editorStore'
import { edits } from '../store/edits'
import { useCanvasCommands } from './canvasCommands'
import { freeSpot, newNodeRecord } from './newNode'
import { useSelection } from './useSelection'

/**
 * Registers the "add node" command while the canvas is shown: a node whose top-left
 * corner is at the centre of the visible canvas, stepped past nodes already there, then selected.
 */
export function useAddNode(projectId: string, chapterId: string, canvas: RefObject<HTMLDivElement | null>): void {
  const { screenToFlowPosition } = useReactFlow()
  const store = useStoreApi()
  useEffect(() => {
    const add = () => {
      const box = canvas.current?.getBoundingClientRect()
      if (box === undefined) return
      const centre = screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
      const taken = liveNodes(editorStore.getState().content, chapterId)
      // In a chapter that was empty when opened, React Flow's first fit is still queued and would run
      // when this node appears, moving the view by half a card. Cancel it: the node goes where it was placed.
      store.setState({ fitViewQueued: false })
      const node = newNodeRecord(projectId, chapterId, freeSpot(centre, taken))
      void edits.create('nodes', node, 'Add node')
      useSelection.getState().set([node.id], null)
    }
    useCanvasCommands.getState().setAddNode(add)
    return () => useCanvasCommands.getState().setAddNode(null)
  }, [projectId, chapterId, canvas, screenToFlowPosition, store])
}
