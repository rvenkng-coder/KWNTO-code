import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import { memo } from 'react'
import { EditingBadge } from '../../presence/EditingBadge'
import { useCommentStore } from '../../comments/useNodeComments'
import { countLabel } from '../../comments/commentList'
import { useTheme } from '../../shell/theme'
import { NODE_COLORS } from '../model/colors'
import { jumpToNode } from '../search/jump'
import { CardAttachments } from './NodeCardAttachments'
import { edits } from '../store/edits'
import { choiceHandleId, MIN_CARD_HEIGHT, MIN_CARD_WIDTH, NEW_CHOICE_HANDLE, type CardChoice, type CardCue, type CardNode, type CrossLink, type NodeCardData } from '../model/flow'

function Badges({ marker }: { marker: NodeCardData['marker'] }) {
  const badges = [marker.isStart && 'Start', marker.isEnd && 'End', marker.isUnreachable && 'Unreachable'].filter(Boolean)
  if (badges.length === 0) return null
  return (
    <span className="flex gap-1">
      {badges.map((b) => (
        <span key={String(b)} data-testid="node-badge" className="rounded-base bg-panel px-1 text-[0.85em] text-text">{b}</span>
      ))}
    </span>
  )
}

/** The number of comments on a node; nothing at 0. */
function CommentBadge({ nodeId }: { nodeId: string }) {
  const count = useCommentStore((s) => s.counts[nodeId] ?? 0)
  if (count === 0) return null
  return <span data-testid="comment-badge" aria-label={countLabel(count)} className="rounded-full bg-panel px-1.5 text-[0.85em] text-text">{count}</span>
}

function CrossLinkTag({ link }: { link: CrossLink }) {
  return (
    // nodrag: a press on the tag must not start a drag of the card; the click jumps instead of selecting the card.
    <button type="button" data-testid="cross-link" className="nodrag truncate text-left text-accent hover:underline"
      onClick={(e) => {
        e.stopPropagation()
        jumpToNode(link.targetNodeId)
      }}>
      {link.text}
    </button>
  )
}

// Each row is positioned and spans the card, so its dot sits on the card's right edge level with its own text.
function ChoiceRow({ choice }: { choice: CardChoice }) {
  const text = choice.untitled ? 'text-muted italic' : ''
  return (
    <div data-testid="choice-row" className="relative flex px-3 py-0.5 text-[0.85em]">
      {choice.crossLink === null
        ? <span className={`truncate rounded-full border border-border bg-bg px-2 ${text}`}>{choice.text}</span>
        : <CrossLinkTag link={choice.crossLink} />}
      <Handle type="source" position={Position.Right} id={choiceHandleId(choice.id)}
        className={choice.linked ? '' : '!bg-panel !border-border'} />
    </div>
  )
}

function Choices({ choices }: { choices: CardChoice[] }) {
  return (
    <div className="flex flex-col pb-1">
      {choices.map((c) => <ChoiceRow key={c.id} choice={c} />)}
      <div className="relative flex px-3 text-[0.85em] text-muted">
        <span>+</span>
        <Handle type="source" position={Position.Right} id={NEW_CHOICE_HANDLE} data-testid="new-choice-handle" />
      </div>
    </div>
  )
}

function Cues({ cues, more }: { cues: CardCue[]; more: number }) {
  if (cues.length === 0) return null
  return (
    <div className="flex flex-col gap-0.5 px-3 pb-1.5 text-[0.85em]">
      {cues.map((q, i) => <p key={i} className="truncate"><span className="text-accent">{q.tag}</span> {q.text}</p>)}
      {more > 0 && <p className="text-muted">+{more} more</p>}
    </div>
  )
}

/** One node on the canvas (design 6.1, D9): coloured header with the title, three lines, cues, media, links and a row per choice. */
function NodeCardView({ id, data, selected }: NodeProps<CardNode>) {
  const theme = useTheme()
  const ring = selected ? 'border-accent ring-1 ring-accent' : 'border-border'
  const tint = NODE_COLORS[data.color][theme]
  return (
    // No overflow-hidden on the card itself: it would cut the connection handles on its edges in half.
    <div data-testid="node-card" data-node-id={id} className={`flex h-full w-full flex-col rounded-[var(--radius-lg)] border bg-card text-text shadow-[var(--shadow-card)] ${ring}`}
      style={{ fontSize: 'var(--card-font-size, 13px)' }}>
      {/* Drag a corner or edge of the selected card to resize it; the size is saved when the drag ends (0 = default size). */}
      <NodeResizer isVisible={selected} minWidth={MIN_CARD_WIDTH} minHeight={MIN_CARD_HEIGHT}
        onResizeEnd={(_, p) => void edits.update('nodes', id, { x: Math.round(p.x), y: Math.round(p.y), width: Math.round(p.width), height: Math.round(p.height) }, 'Resize node')} />
      <Handle type="target" position={Position.Left} />
      <div className="min-h-0 flex-1 overflow-hidden rounded-t-[var(--radius-lg)]">
        {/* The header tint is node data from the palette (colors.ts), the one allowed inline colour. */}
        <div className="flex items-center justify-between gap-1 px-3 py-2"
          style={{ background: `color-mix(in srgb, ${tint} 24%, var(--color-card))`, borderTop: `3px solid ${tint}` }}>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[1.15em] font-semibold">{data.title || 'Untitled'}</span>
            <EditingBadge nodeId={id} />
          </span>
          <span className="flex items-center gap-1"><CommentBadge nodeId={id} /><Badges marker={data.marker} /></span>
        </div>
        <div className="flex flex-col gap-0.5 px-3 py-2 text-[1em]">
          {data.preview.map((p, i) => <p key={i} className="truncate">{p}</p>)}
          {data.more > 0 && <p className="text-muted">+{data.more} more</p>}
        </div>
        <Cues cues={data.cues} more={data.moreCues} />
        <CardAttachments nodeId={id} />
      </div>
      <Choices choices={data.choices} />
    </div>
  )
}

// PERF: What: memo on the card. Why: a change to one node re-renders only that card, not all
// 500 in a large chapter. Trade-off: a card that should change must get a new data object.
export const NodeCard = memo(NodeCardView)
