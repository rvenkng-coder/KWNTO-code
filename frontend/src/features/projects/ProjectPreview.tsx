import { useEffect, useState } from 'react'
import { backend } from '../../backend'
import type { ProjectPreview as Preview } from '../../backend/types'
import { DEFAULT_CARD_WIDTH } from '../editor/model/flow'

const DEFAULT_CARD_HEIGHT = 110
const PAD = 40

function plural(n: number, one: string): string {
  return `${n} ${one}${n === 1 ? '' : 's'}`
}

/** A small picture of the project's first chapter: each node a box where it sits on the canvas. */
function NodeMap({ nodes }: { nodes: Preview['nodes'] }) {
  if (nodes.length === 0) return <p className="m-auto text-xs text-muted">No nodes yet</p>
  const boxes = nodes.map((n) => ({
    x: n.x,
    y: n.y,
    w: n.width > 0 ? n.width : DEFAULT_CARD_WIDTH,
    h: n.height > 0 ? n.height : DEFAULT_CARD_HEIGHT,
  }))
  const minX = Math.min(...boxes.map((b) => b.x)) - PAD
  const minY = Math.min(...boxes.map((b) => b.y)) - PAD
  const width = Math.max(...boxes.map((b) => b.x + b.w)) + PAD - minX
  const height = Math.max(...boxes.map((b) => b.y + b.h)) + PAD - minY
  return (
    <svg
      viewBox={`${minX} ${minY} ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      aria-hidden="true"
    >
      {boxes.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx={12}
          className="fill-card stroke-muted"
          strokeWidth={6}
        />
      ))}
    </svg>
  )
}

/** The preview on a project card: the picture and "N chapters · M nodes". It loads quietly and shows nothing if it cannot. */
export function ProjectPreview({ projectId, compact = false }: { projectId: string; compact?: boolean }) {
  const [preview, setPreview] = useState<Preview | null>(null)
  useEffect(() => {
    let current = true
    backend.projects
      .preview(projectId)
      .then((p) => current && setPreview(p))
      .catch(() => undefined)
    return () => {
      current = false
    }
  }, [projectId])
  return (
    <div data-testid="project-preview" className="flex flex-col gap-1">
      <div
        className={`flex ${compact ? 'h-14' : 'h-24'} items-center justify-center overflow-hidden rounded-base border border-border bg-bg`}
      >
        {preview !== null && <NodeMap nodes={preview.nodes} />}
      </div>
      {!compact && (
        <p className="text-xs text-muted">
          {preview === null ? ' ' : `${plural(preview.chapterCount, 'chapter')} · ${plural(preview.nodeCount, 'node')}`}
        </p>
      )}
    </div>
  )
}
