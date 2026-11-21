import { useMemo } from 'react'
import type { Cue, CueType } from '../../../backend'
import { cuesOf } from '../model/state'
import { useEditor } from '../store/editorStore'
import { edits } from '../store/edits'
import { EditingBadge } from '../../presence/EditingBadge'
import { presenceFocus } from '../../presence/usePresence'
import { useSavedText } from '../store/useSavedText'
import { ToolButton } from '../canvas/ToolButton'
import { insertRow, moveRow } from './rowActions'
import { useRowDrag } from './rowDrag'
import { AddButton, CARD, Grip } from './RowControls'
import { SectionLabel } from './SectionLabel'

// The cues of one node (design 6.2): audio, lighting or other, each with a note. Media files are Plan 5.

const CUE_TYPES: CueType[] = ['audio', 'lighting', 'other']

interface CueRowProps { cue: Cue; index: number; onMove(id: string, toIndex: number): void }

function CueRow({ cue, index, onMove }: CueRowProps) {
  const [text, setText, flush] = useSavedText('cues', cue.id, 'text', cue.text)
  const marks = presenceFocus(cue.nodeId, `cue:${cue.id}`)
  const drag = useRowDrag('cues', cue.id, index, (to) => onMove(cue.id, to), (from) => onMove(from, index))
  return (
    <li data-testid="cue-row" className={`${CARD} ${drag.over ? 'border-accent' : 'border-border'}`} {...drag.row}>
      <div className="flex items-center gap-1">
        <Grip what="cue" extra={drag.grip} />
        <select className="field min-w-0 flex-1" aria-label="Cue type" value={cue.type}
          onChange={(e) => void edits.update('cues', cue.id, { type: e.target.value as CueType }, 'Change cue type')}>
          {CUE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <ToolButton icon="trash" name="Delete cue" danger align="end" onClick={() => void edits.remove('cues', cue.id, 'Delete cue')} />
      </div>
      <EditingBadge nodeId={cue.nodeId} field={`cue:${cue.id}`} />
      <input className="field" aria-label="Cue text" placeholder="Cue" value={text}
        onChange={(e) => setText(e.target.value)} onFocus={marks.onFocus} onBlur={() => {
          marks.onBlur()
          flush()
        }} />
    </li>
  )
}

export function Cues({ projectId, nodeId }: { projectId: string; nodeId: string }) {
  const content = useEditor((s) => s.content)
  const cues = useMemo(() => cuesOf(content, nodeId), [content, nodeId])
  const add = () => {
    const make = (id: string, sortOrder: number): Cue => ({ id, projectId, nodeId, type: 'other', text: '', sortOrder, version: 0 })
    void insertRow('cues', cues, cues.length, make)
  }
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>Cues</SectionLabel>
      <ol className="flex flex-col gap-2">
        {cues.map((cue, i) => (
          <CueRow key={cue.id} cue={cue} index={i} onMove={(id, to) => void moveRow('cues', cues, id, to)} />
        ))}
      </ol>
      <AddButton name="Add cue" onClick={add} />
    </section>
  )
}
