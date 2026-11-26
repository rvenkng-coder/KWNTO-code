import type { Connection } from '../../../backend'
import { useLinkMode } from '../canvas/linkMode'
import { useEditor } from '../store/editorStore'
import { edits } from '../store/edits'
import { EditingBadge } from '../../presence/EditingBadge'
import { presenceFocus } from '../../presence/usePresence'
import { useSavedText } from '../store/useSavedText'
import { ToolButton } from '../canvas/ToolButton'
import { CARD } from './RowControls'

/** One choice of the selected node: its text, where it leads, and the Link or Re-link, Unlink and Delete icons. */
export function ChoiceRow({ choice, autoFocus }: { choice: Connection; autoFocus: boolean }) {
  const [text, setText, flush] = useSavedText('connections', choice.id, 'label', choice.label)
  const target = useEditor((s) => (choice.toNodeId === null ? undefined : s.content.nodes[choice.toNodeId]))
  const linked = choice.toNodeId !== null
  const marks = presenceFocus(choice.fromNodeId, `choice:${choice.id}`)
  return (
    <li data-testid="panel-choice" className={`${CARD} border-border`}>
      <EditingBadge nodeId={choice.fromNodeId} field={`choice:${choice.id}`} />
      <div className="flex items-center gap-1">
        <input
          className="field min-w-0 flex-1"
          aria-label="Choice text"
          placeholder="Choice text"
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={marks.onFocus}
          onBlur={() => {
            marks.onBlur()
            flush()
          }}
        />
        <ToolButton
          icon="link"
          name={linked ? 'Re-link' : 'Link'}
          align="end"
          onClick={() => useLinkMode.getState().start(choice.id)}
        />
        {linked && (
          <ToolButton
            icon="unlink"
            name="Unlink"
            align="end"
            onClick={() => void edits.update('connections', choice.id, { toNodeId: null }, 'Unlink choice')}
          />
        )}
        <ToolButton
          icon="trash"
          name="Delete"
          danger
          align="end"
          onClick={() => void edits.remove('connections', choice.id, 'Delete choice')}
        />
      </div>
      <p className="text-muted">{linked ? `Linked → ${target?.title || 'Untitled'}` : 'Not linked'}</p>
    </li>
  )
}
