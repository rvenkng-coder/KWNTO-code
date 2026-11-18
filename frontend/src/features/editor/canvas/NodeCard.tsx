import { Handle, Position, type NodeProps } from '@xyflow/react'
import { memo } from 'react'
import { useTheme } from '../../shell/theme'
import { NODE_COLORS } from '../model/colors'
import { jumpToNode } from '../search/jump'
import { choiceHandleId, NEW_CHOICE_HANDLE, type CardChoice, type CardCue, type CardNode, type CrossLink, type NodeCardData } from '../model/flow'

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
    <div data-testid="choice-row" className="relative flex px-2 py-0.5 text-xs">
      {choice.crossLink === null
        ? <span className={`truncate rounded-base bg-bg px-1.5 ${text}`}>{choice.text}</span>
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
      <div className="relative flex px-2 text-xs text-muted">
        <span>+</span>
        <Handle type="source" position={Position.Right} id={NEW_CHOICE_HANDLE} data-testid="new-choice-handle" />
      </div>
    </div>
  )
}

function Cues({ cues, more }: { cues: CardCue[]; more: number }) {
  if (cues.length === 0) return null
  return (
    <div className="flex flex-col gap-0.5 px-2 pb-1 text-xs">
      {cues.map((q, i) => <p key={i} className="truncate"><span className="text-accent">{q.tag}</span> {q.text}</p>)}
      {more > 0 && <p className="text-muted">+{more} more</p>}
    </div>
  )
}

/** One node on the canvas (design 6.1, D9): coloured header with the title, three lines, cues and a row per choice. */
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
      </div>
      <Cues cues={data.cues} more={data.moreCues} />
      <Choices choices={data.choices} />
    </div>
  )
}

// PERF: What: memo on the card. Why: a change to one node re-renders only that card, not all
// 500 in a large chapter. Trade-off: a card that should change must get a new data object.
export const NodeCard = memo(NodeCardView)
