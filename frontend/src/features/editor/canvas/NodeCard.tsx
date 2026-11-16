import { Handle, Position, type NodeProps } from '@xyflow/react'
import { memo } from 'react'
import { useTheme } from '../../shell/theme'
import { NODE_COLORS } from '../model/colors'
import type { CardNode, NodeCardData } from '../model/flow'

function Badges({ marker }: { marker: NodeCardData['marker'] }) {
  const badges = [marker.isStart && 'Start', marker.isEnd && 'End', marker.isUnreachable && 'Unreachable'].filter(Boolean)
  if (badges.length === 0) return null
  return (
    <span className="flex gap-1">
      {badges.map((b) => (
        <span key={String(b)} data-testid="node-badge" className="rounded-base bg-panel px-1 text-xs text-text">{b}</span>
      ))}
    </span>
  )
}

/** One node on the canvas (design 6.1, D9): coloured header with the title, three lines, cross-chapter tags. */
function NodeCardView({ id, data, selected }: NodeProps<CardNode>) {
  const theme = useTheme()
  const ring = selected ? 'border-accent' : 'border-border'
  return (
    <div data-testid="node-card" data-node-id={id} className={`w-56 overflow-hidden rounded-base border-2 bg-panel text-text ${ring}`}>
      <Handle type="target" position={Position.Left} />
      {/* The header colour is node data from the palette (colors.ts), the one allowed inline colour. */}
      <div className="flex items-center justify-between gap-1 px-2 py-1 text-white" style={{ background: NODE_COLORS[data.color][theme] }}>
        <span className="truncate font-semibold">{data.title || 'Untitled'}</span>
        <Badges marker={data.marker} />
      </div>
      <div className="flex flex-col gap-0.5 px-2 py-1 text-xs">
        {data.preview.map((p, i) => <p key={i} className="truncate">{p}</p>)}
        {data.more > 0 && <p className="text-muted">+{data.more} more</p>}
        {data.crossLinks.map((l) => <p key={l.connectionId} data-testid="cross-link" className="truncate text-accent">{l.text}</p>)}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

// PERF: What: memo on the card. Why: a change to one node re-renders only that card, not all
// 500 in a large chapter. Trade-off: a card that should change must get a new data object.
export const NodeCard = memo(NodeCardView)
