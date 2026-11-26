import { Background, BackgroundVariant, Controls, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMemo, useState, type ReactNode } from 'react'
import type { ProjectFile } from '../../backend'
import { toFlowEdges, toFlowNodes, type CardNode } from '../editor/model/flow'
import { nodeMarkers } from '../editor/model/markers'
import { fromContent } from '../editor/model/state'
import { SharePlay } from '../player/SharePlay'
import { CoverSource } from './coverSource'
import { ReadOnlyCard } from './ReadOnlyCard'
import { ReadOnlyPanel } from './ReadOnlyPanel'
import { contentFromFile } from './shareModel'

// Defined once, outside the component: a new object per render would re-mount every node.
const nodeTypes = { card: ReadOnlyCard }

interface ReadOnlyViewerProps {
  projectId: string
  file: ProjectFile
  token: string
  /** Comment links load their media with the person's token. */
  needsSignIn: boolean
  /** Task 5 renders a node's comments here. */
  renderComments?: (nodeId: string) => ReactNode
}

/** The shared project: name, chapter tabs, a canvas that pans and zooms but changes nothing, and a node's text beside it. */
export function ReadOnlyViewer({ projectId, file, token, needsSignIn, renderComments }: ReadOnlyViewerProps) {
  const state = useMemo(() => fromContent(contentFromFile(file, projectId)), [file, projectId])
  const chapters = useMemo(() => [...file.chapters].sort((a, b) => a.position - b.position), [file])
  const [picked, setPicked] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const chapterId = (chapters.find((c) => c.id === picked) ?? chapters[0])?.id ?? ''
  const nodes = useMemo(() => toFlowNodes(state, chapterId, nodeMarkers(state)), [state, chapterId])
  const edges = useMemo(() => toFlowEdges(state, chapterId), [state, chapterId])
  const shown = nodes.map((n) => ({ ...n, selected: n.id === selected }))
  const covers = useMemo(() => ({ token, needsSignIn, media: file.media }), [token, needsSignIn, file])

  return (
    <div data-testid="viewer" className="flex min-h-[70vh] flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">{file.project.name}</h2>
        <SharePlay file={file} projectId={projectId} token={token} needsSignIn={needsSignIn} />
      </div>
      <div role="tablist" className="flex flex-wrap gap-1">
        {chapters.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === chapterId}
            className={c.id === chapterId ? 'btn-primary' : 'btn'}
            onClick={() => {
              setPicked(c.id)
              setSelected(null)
            }}
          >
            {c.title}
          </button>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_18rem] gap-3">
        <div className="kwnto-canvas panel relative min-h-[60vh] p-0" data-testid="canvas">
          <CoverSource.Provider value={covers}>
            <ReactFlowProvider>
              <ReactFlow<CardNode>
                nodes={shown}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ maxZoom: 1 }}
                nodesDraggable={false}
                nodesConnectable={false}
                edgesFocusable={false}
                deleteKeyCode={null}
                zoomOnDoubleClick={false}
                onNodeClick={(_e, node) => setSelected(node.id)}
                onPaneClick={() => setSelected(null)}
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
                <Controls showInteractive={false} />
              </ReactFlow>
            </ReactFlowProvider>
          </CoverSource.Provider>
        </div>
        {selected !== null && (
          <ReadOnlyPanel file={file} nodeId={selected} token={token} needsSignIn={needsSignIn}>
            {renderComments?.(selected)}
          </ReadOnlyPanel>
        )}
      </div>
    </div>
  )
}
