import type { Connection } from '../../../backend'
import { useSelection } from '../canvas/useSelection'
import { edits } from '../store/edits'
import { useSavedText } from '../store/useSavedText'
import { SectionLabel } from './SectionLabel'

/** A selected connection: its label (the choice text a player sees) and Delete connection. */
export function ConnectionFields({ connection }: { connection: Connection }) {
  const [label, setLabel, flush] = useSavedText('connections', connection.id, 'label', connection.label)
  const remove = () => {
    useSelection.getState().set([], null)
    void edits.remove('connections', connection.id, 'Delete connection')
  }
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Connection</SectionLabel>
      <label className="flex flex-col gap-1">
        <span>Choice text</span>
        <input className="field" value={label} onChange={(e) => setLabel(e.target.value)} onBlur={flush} />
      </label>
      <button type="button" className="btn-danger self-start" onClick={remove}>Delete connection</button>
    </div>
  )
}
