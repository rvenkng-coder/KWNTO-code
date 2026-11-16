import { useMemo } from 'react'
import type { Cue, CueType } from '../../../backend'
import { cuesOf } from '../model/state'
import { editorStore, useEditor } from '../store/editorStore'
import { useSavedText } from '../store/useSavedText'
import { insertRow, moveRow } from './rowActions'

// The cues of one node (design 6.2): audio, lighting or other, each with a note. Media files are Plan 5.

const CUE_TYPES: CueType[] = ['audio', 'lighting', 'other']

interface CueRowProps { cue: Cue; isFirst: boolean; isLast: boolean; onMove(by: -1 | 1): void }

function CueRow({ cue, isFirst, isLast, onMove }: CueRowProps) {
  const [text, setText, flush] = useSavedText('cues', cue.id, 'text', cue.text)
  const store = editorStore.getState
  return (
    <li data-testid="cue-row" className="flex flex-col gap-1 border-b border-border pb-2">
      <select className="field" aria-label="Cue type" value={cue.type}
        onChange={(e) => void store().update('cues', cue.id, { type: e.target.value as CueType })}>
        {CUE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <input className="field" aria-label="Cue text" placeholder="Cue" value={text}
        onChange={(e) => setText(e.target.value)} onBlur={flush} />
      <div className="flex gap-1">
        <button type="button" className="btn" disabled={isFirst} onClick={() => onMove(-1)}>Move up</button>
        <button type="button" className="btn" disabled={isLast} onClick={() => onMove(1)}>Move down</button>
        <button type="button" className="btn-danger" onClick={() => void store().remove('cues', cue.id)}>Delete cue</button>
      </div>
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
      <h3 className="font-semibold">Cues</h3>
      <ol className="flex flex-col gap-2">
        {cues.map((cue, i) => (
          <CueRow key={cue.id} cue={cue} isFirst={i === 0} isLast={i === cues.length - 1}
            onMove={(by) => void moveRow('cues', cues, cue.id, i + by)} />
        ))}
      </ol>
      <button type="button" className="btn self-start" onClick={add}>Add cue</button>
    </section>
  )
}
