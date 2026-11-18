import type { Connection } from '../../../backend'
import { useLinkMode } from '../canvas/linkMode'
import { useEditor } from '../store/editorStore'
import { edits } from '../store/edits'
import { useSavedText } from '../store/useSavedText'

/** One choice of the selected node: its text, where it leads, and Link or Re-link, Unlink and Delete. */
export function ChoiceRow({ choice, autoFocus }: { choice: Connection; autoFocus: boolean }) {
  const [text, setText, flush] = useSavedText('connections', choice.id, 'label', choice.label)
  const target = useEditor((s) => (choice.toNodeId === null ? undefined : s.content.nodes[choice.toNodeId]))
  const linked = choice.toNodeId !== null
  return (
    <li data-testid="panel-choice" className="flex flex-col gap-1 border-b border-border pb-2">
      <input className="field" aria-label="Choice text" placeholder="Choice text" autoFocus={autoFocus}
        value={text} onChange={(e) => setText(e.target.value)} onBlur={flush} />
      <p className="text-muted">{linked ? `Linked → ${target?.title || 'Untitled'}` : 'Not linked'}</p>
      <div className="flex gap-1">
        <button type="button" className="btn-quiet" onClick={() => useLinkMode.getState().start(choice.id)}>{linked ? 'Re-link' : 'Link'}</button>
        {linked && (
          <button type="button" className="btn-quiet" onClick={() => void edits.update('connections', choice.id, { toNodeId: null }, 'Unlink choice')}>Unlink</button>
        )}
        <button type="button" className="btn-danger" onClick={() => void edits.remove('connections', choice.id, 'Delete choice')}>Delete</button>
      </div>
    </li>
  )
}
