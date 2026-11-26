import { Handle, Position, type NodeProps } from '@xyflow/react'
import { memo } from 'react'
import { NODE_COLORS } from '../editor/model/colors'
import { choiceHandleId, type CardNode } from '../editor/model/flow'
import { useTheme } from '../shell/theme'
import { ShareCover } from './ShareCover'

// A node as the read-only viewer draws it: the editor card's look, without the editor store
// (the viewer never imports it), without the "+" handle and with handles that cannot connect.
function ReadOnlyCardView({ id, data, selected }: NodeProps<CardNode>) {
  const theme = useTheme()
  const tint = NODE_COLORS[data.color][theme]
  const ring = selected ? 'border-accent ring-1 ring-accent' : 'border-border'
  return (
    <div data-testid="node-card" data-node-id={id} className={`flex h-full w-full flex-col overflow-hidden rounded-[var(--radius-lg)] border bg-card text-text shadow-[var(--shadow-card)] ${ring}`}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      {/* As on the editor's card: a card made too small cuts off its text, never its choices. */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <ShareCover mediaId={data.coverMediaId} />
        <div className="flex items-center justify-between gap-1 px-3 py-2"
          style={{ background: `color-mix(in srgb, ${tint} 24%, var(--color-card))`, borderTop: `3px solid ${tint}` }}>
          <span className="truncate font-semibold">{data.title || 'Untitled'}</span>
          {data.marker.isStart && <span className="rounded-base bg-panel px-1 text-xs text-text">Start</span>}
        </div>
        <div className="flex flex-col gap-0.5 px-3 py-2 text-[13px]">
          {data.preview.map((p, i) => <p key={i} className="truncate">{p}</p>)}
          {data.more > 0 && <p className="text-muted">+{data.more} more</p>}
        </div>
      </div>
      <div className="flex flex-col pb-1">
        {data.choices.map((c) => (
          <div key={c.id} data-testid="choice-row" className="relative flex px-3 py-0.5 text-xs">
            <span className={`truncate rounded-full border border-border bg-bg px-2 ${c.untitled ? 'text-muted italic' : ''}`}>
              {c.crossLink === null ? c.text : c.crossLink.text}
            </span>
            <Handle type="source" position={Position.Right} id={choiceHandleId(c.id)} isConnectable={false} />
          </div>
        ))}
      </div>
    </div>
  )
}

export const ReadOnlyCard = memo(ReadOnlyCardView)
