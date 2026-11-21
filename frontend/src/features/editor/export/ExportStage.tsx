import { applyNodeChanges, getNodesBounds, ReactFlow, ReactFlowProvider, useNodesInitialized, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NodeCard } from '../canvas/NodeCard'
import { toFlowEdges, toFlowNodes } from '../model/flow'
import { nodeMarkers } from '../model/markers'
import { editorStore } from '../store/editorStore'
import { ThemeOverride } from '../../shell/theme'
import { exportPixelRatio, isSmallText, MAP_PADDING, type MapImage } from './exportPlan'

// PERF: What: nodeTypes defined once, outside the component. Why: a new object each render
// makes React Flow re-mount every node. Trade-off: none.
const nodeTypes = { card: NodeCard }

export type StageKind = 'png' | 'jpeg'
interface StageProps { chapterId: string; kind: StageKind; onImage(img: MapImage): void; onError(): void }

// html-to-image copies no style onto SVG children, so an edge drawn with CSS classes loses its line
// and its label box turns black. The edges therefore carry their paint inline, the light tokens of
// index.css (--color-muted, --color-panel, --color-text, --color-border).
const EDGE_PAINT = {
  style: { stroke: '#6b7280', strokeWidth: 1.5 },
  labelStyle: { fill: '#111827', fontSize: 12 },
  labelBgStyle: { fill: '#ffffff', stroke: '#d1d5db' },
  labelBgPadding: [6, 3] as [number, number],
  labelBgBorderRadius: 4,
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

async function capture(root: HTMLElement, title: string, kind: StageKind, bounds: { x: number; y: number; width: number; height: number }): Promise<MapImage> {
  await document.fonts.ready
  await nextFrame()
  await nextFrame()
  const viewport = root.querySelector<HTMLElement>('.react-flow__viewport')
  if (viewport === null) throw new Error('No viewport')
  const x = bounds.x - MAP_PADDING
  const y = bounds.y - MAP_PADDING
  const width = Math.ceil(bounds.width + 2 * MAP_PADDING)
  const height = Math.ceil(bounds.height + 2 * MAP_PADDING)
  const ratio = exportPixelRatio(width, height)
  // PERF: What: load html-to-image only when an export starts. Why: the library is not needed
  // to edit (D1). Trade-off: the first export waits for one extra download.
  const { toJpeg, toPng } = await import('html-to-image')
  const options = {
    backgroundColor: '#ffffff', width, height, pixelRatio: ratio,
    style: { width: `${width}px`, height: `${height}px`, transform: `translate(${-x}px, ${-y}px) scale(1)` },
  }
  const dataUrl = kind === 'jpeg' ? await toJpeg(viewport, { ...options, quality: 0.92 }) : await toPng(viewport, options)
  return { chapterTitle: title, dataUrl, width: Math.round(width * ratio), height: Math.round(height * ratio), small: isSmallText(ratio) }
}

function Capture({ root, title, kind, onImage, onError }: Omit<StageProps, 'chapterId'> & { root: React.RefObject<HTMLDivElement | null>; title: string }) {
  const flow = useReactFlow()
  const ready = useNodesInitialized()
  const started = useRef(false)
  useEffect(() => {
    const element = root.current
    if (!ready || started.current || element === null) return
    started.current = true
    capture(element, title, kind, getNodesBounds(flow.getNodes())).then(onImage, onError)
  }, [ready, root, flow, title, kind, onImage, onError])
  return null
}

/**
 * Draws one chapter's map off screen, in the light look on white (D4), and turns it into an image (D2).
 * It only reads the store: the visible canvas, the selection and the undo history are untouched (D8).
 */
export function ExportStage(props: StageProps) {
  const root = useRef<HTMLDivElement | null>(null)
  // A snapshot of the chapter taken when the stage opens, so an edit during the export cannot change the picture.
  // React Flow reports the measured sizes through onNodesChange; without applying them the nodes never count as initialized.
  const [{ edges, initial, title }] = useState(() => {
    const content = editorStore.getState().content
    return {
      title: content.chapters[props.chapterId]?.title ?? '',
      initial: toFlowNodes(content, props.chapterId, nodeMarkers(content)),
      edges: toFlowEdges(content, props.chapterId).map((e) => ({ ...e, ...EDGE_PAINT })),
    }
  })
  const [nodes, setNodes] = useState(initial)
  return createPortal(
    <div ref={root} data-testid="export-stage" aria-hidden="true" data-theme="light"
      className="kwnto-canvas" style={{ position: 'fixed', left: -20000, top: 0, width: 1600, height: 1000 }}>
      <ThemeOverride.Provider value="light">
        <ReactFlowProvider>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={(c) => setNodes((n) => applyNodeChanges(c, n))}
            nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
            panOnDrag={false} zoomOnScroll={false} zoomOnPinch={false} zoomOnDoubleClick={false} preventScrolling={false}>
            <Capture root={root} title={title} kind={props.kind} onImage={props.onImage} onError={props.onError} />
          </ReactFlow>
        </ReactFlowProvider>
      </ThemeOverride.Provider>
    </div>,
    document.body,
  )
}
