import {
  applyEdgeChanges, applyNodeChanges, Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider, useNodesInitialized, useReactFlow,
  type Connection as FlowConnection, type Edge, type EdgeChange, type NodeChange, type OnNodeDrag,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { backend } from '../../../backend'
import { DEFAULT_NODE_COLOR } from '../model/colors'
import { toFlowEdges, toFlowNodes, type CardNode } from '../model/flow'
import { newId } from '../model/ids'
import { effectiveStart, nodeMarkers } from '../model/markers'
import { liveNodes } from '../model/state'
import { editorStore, useEditor } from '../store/editorStore'
import { edits } from '../store/edits'
import { CanvasToolbar } from './CanvasToolbar'
import { NodeCard } from './NodeCard'
import { fromSelectChanges } from './selectionChanges'
import { useCanvasFocus } from './useCanvasFocus'
import { plural } from './selectionActions'
import { useSelection } from './useSelection'

// The canvas of one chapter (design 6.1) on React Flow. The store holds the content; React
// Flow keeps its own copy of the nodes (measured sizes, positions while dragging) that is
// merged with the store on every change. Positions are saved on drag end only.

// PERF: What: nodeTypes defined once, outside the component. Why: a new object on each
// render makes React Flow re-mount every node. Trade-off: none.
const nodeTypes = { card: NodeCard }

const sameData = (a: CardNode['data'], b: CardNode['data']) => JSON.stringify(a) === JSON.stringify(b)

// PERF: What: keep the old node object (and its data object) when nothing about it changed.
// Why: the memoised cards then skip re-rendering, so one edit re-renders one card, not 500.
// Trade-off: a JSON comparison of each card's small data on every content change.
function mergeNodes(prev: CardNode[], next: CardNode[], selected: Set<string>): CardNode[] {
  const old = new Map(prev.map((n) => [n.id, n]))
  return next.map((n) => {
    const o = old.get(n.id)
    const isSelected = selected.has(n.id)
    if (o === undefined) return { ...n, selected: isSelected }
    const position = o.dragging === true ? o.position : n.position
    const unchanged = o.position.x === position.x && o.position.y === position.y && o.selected === isSelected && sameData(o.data, n.data)
    return unchanged ? o : { ...o, position, selected: isSelected, data: sameData(o.data, n.data) ? o.data : n.data }
  })
}

function mergeEdges(prev: Edge[], next: Edge[], selectedId: string | null): Edge[] {
  return next.map((e) => ({ ...e, selected: e.id === selectedId }))
    .map((e) => prev.find((p) => p.id === e.id && p.selected === e.selected && p.label === e.label) ?? e)
}

// The person changed the selection on the canvas (see selectionChanges.ts for why only these changes count).
function takeSelection(chapterId: string, nodeChanges: NodeChange<CardNode>[], edgeChanges: EdgeChange[]): void {
  const shown = new Set(liveNodes(editorStore.getState().content, chapterId).map((n) => n.id))
  const next = fromSelectChanges(useSelection.getState(), nodeChanges, edgeChanges, shown)
  if (next !== null) useSelection.getState().set(next.nodeIds, next.connectionId)
}

// React Flow's local nodes and edges, re-merged during render whenever the store or the selection changes.
function useFlowState(chapterId: string) {
  const content = useEditor((s) => s.content)
  const selectedNodes = useSelection((s) => s.nodeIds)
  const selectedEdge = useSelection((s) => s.connectionId)
  const markers = useMemo(() => nodeMarkers(content), [content])
  const nextNodes = useMemo(() => toFlowNodes(content, chapterId, markers), [content, chapterId, markers])
  const nextEdges = useMemo(() => toFlowEdges(content, chapterId), [content, chapterId])
  const [flow, setFlow] = useState({ from: [] as unknown[], nodes: [] as CardNode[], edges: [] as Edge[] })
  const from = [nextNodes, nextEdges, selectedNodes, selectedEdge]
  if (from.some((x, i) => x !== flow.from[i])) {
    setFlow({ from, nodes: mergeNodes(flow.nodes, nextNodes, new Set(selectedNodes)), edges: mergeEdges(flow.edges, nextEdges, selectedEdge) })
  }
  const onNodesChange = useCallback((changes: NodeChange<CardNode>[]) => {
    setFlow((f) => ({ ...f, nodes: applyNodeChanges(changes, f.nodes) }))
    takeSelection(chapterId, changes, [])
  }, [chapterId])
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setFlow((f) => ({ ...f, edges: applyEdgeChanges(changes, f.edges) }))
    takeSelection(chapterId, [], changes)
  }, [chapterId])
  const synced = flow.from[0] === nextNodes
  return { nodes: flow.nodes, edges: flow.edges, onNodesChange, onEdgesChange, synced, hasStart: effectiveStart(content) !== null }
}

function connectionExists(from: string, to: string): boolean {
  return Object.values(editorStore.getState().content.connections).some((c) => c.fromNodeId === from && c.toNodeId === to)
}

// The edits the canvas makes: create, connect, move, trash and remove, and the selection.
function useCanvasActions(projectId: string, chapterId: string) {
  const { screenToFlowPosition } = useReactFlow()
  const createAt = useCallback((e: MouseEvent) => {
    if (!(e.target instanceof Element) || !e.target.classList.contains('react-flow__pane')) return
    const { x, y } = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const id = newId()
    void edits.create('nodes', { id, projectId, chapterId, title: 'New node', color: DEFAULT_NODE_COLOR, x: Math.round(x), y: Math.round(y), deleted: false, version: 0 }, 'Add node')
  }, [screenToFlowPosition, projectId, chapterId])
  const onConnect = useCallback((c: FlowConnection) => {
    if (connectionExists(c.source, c.target)) return
    void edits.create('connections', { id: newId(), projectId, fromNodeId: c.source, toNodeId: c.target, label: '', version: 0 }, 'Connect nodes')
  }, [projectId])
  const onNodeDragStop: OnNodeDrag<CardNode> = useCallback((_e, _node, moved) => {
    // A drag of several nodes is one undo step.
    const label = `Move ${plural(moved.length, 'node')}`
    void edits.group(label, async () => {
      await Promise.all(moved.map((n) => edits.update('nodes', n.id, { x: Math.round(n.position.x), y: Math.round(n.position.y) }, label)))
    })
  }, [])
  // React Flow would also drop the edges of a deleted node; a trashed node keeps its connections
  // (undo brings it back with them), so the canvas makes its own edits and React Flow removes nothing.
  return { createAt, onConnect, onNodeDragStop }
}

// Selects and centres on a requested node of this chapter (search, cross-chapter tags) once React
// Flow has measured the nodes, so the first fitView does not move the view away again.
function useFocusRequest(chapterId: string): void {
  const request = useCanvasFocus((s) => s.request)
  const measured = useNodesInitialized()
  const { getNode, getZoom, setCenter } = useReactFlow()
  useEffect(() => {
    if (request === null || !measured) return
    const node = getNode(request.nodeId)
    if (node === undefined || editorStore.getState().content.nodes[request.nodeId]?.chapterId !== chapterId) return
    const width = node.measured?.width ?? 0
    const height = node.measured?.height ?? 0
    useSelection.getState().set([request.nodeId], null)
    void setCenter(node.position.x + width / 2, node.position.y + height / 2, { zoom: getZoom() })
    useCanvasFocus.getState().done()
  }, [request, measured, chapterId, getNode, getZoom, setCenter])
}

// The minimap choice of the account (user_preferences.minimap_visible), shown until it loads.
function useMinimap(): [boolean, () => void] {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    let cancelled = false
    backend.preferences.get()
      .then((p) => {
        if (!cancelled) setVisible(p.minimapVisible)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
  const toggle = useCallback(() => {
    setVisible((v) => {
      void backend.preferences.set({ minimapVisible: !v }).catch(() => undefined)
      return !v
    })
  }, [])
  return [visible, toggle]
}

function CanvasView({ projectId, chapterId }: { projectId: string; chapterId: string }) {
  const flow = useFlowState(chapterId)
  const actions = useCanvasActions(projectId, chapterId)
  const [minimap, toggleMinimap] = useMinimap()
  useFocusRequest(chapterId)
  const [inited, setInited] = useState(false)
  const count = useEditor((s) => liveNodes(s.content, chapterId).length)
  const anyNode = useEditor((s) => liveNodes(s.content).length > 0)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <CanvasToolbar showNoStart={anyNode && !flow.hasStart} minimapVisible={minimap} onToggleMinimap={toggleMinimap} />
      <div data-testid="canvas" data-node-count={count} data-ready={inited && flow.synced ? 'true' : 'false'} className="kwnto-canvas h-[calc(100vh-14rem)] min-h-96" onDoubleClick={actions.createAt}>
        <ReactFlow<CardNode>
          nodes={flow.nodes} edges={flow.edges} nodeTypes={nodeTypes}
          onNodesChange={flow.onNodesChange} onEdgesChange={flow.onEdgesChange}
          onConnect={actions.onConnect} onNodeDragStop={actions.onNodeDragStop}
          onInit={() => setInited(true)}
          deleteKeyCode={null} zoomOnDoubleClick={false} fitView fitViewOptions={{ maxZoom: 1 }}
          // PERF: What: draw only the nodes and edges in view. Why: a 500-node chapter would put
          // every card in the DOM. Trade-off: cards appear a frame late while panning fast.
          onlyRenderVisibleElements
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
          {minimap && <MiniMap pannable zoomable />}
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}

/** The chapter's canvas: nodes, connections, markers, selection and the minimap. */
export function Canvas({ projectId, chapterId }: { projectId: string; chapterId: string }) {
  return (
    <ReactFlowProvider>
      <CanvasView key={chapterId} projectId={projectId} chapterId={chapterId} />
    </ReactFlowProvider>
  )
}
