import type { NodeColor, StoryNode } from '../../../backend'
import { useTheme } from '../../shell/theme'
import { NODE_COLORS } from '../model/colors'
import { editorStore, useEditor } from '../store/editorStore'
import { useSavedText } from '../store/useSavedText'
import { Cues } from './Cues'
import { ScriptLines } from './ScriptLines'

const COLOR_NAMES = Object.keys(NODE_COLORS) as NodeColor[]

function ColorSwatches({ node }: { node: StoryNode }) {
  const theme = useTheme()
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Colour">
      {COLOR_NAMES.map((c) => (
        // The swatch colour is node data from the palette (colors.ts), the one allowed inline colour.
        <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={node.color === c}
          className={`h-6 w-6 rounded-base border-2 ${node.color === c ? 'border-text' : 'border-transparent'}`}
          style={{ background: NODE_COLORS[c][theme] }}
          onClick={() => void editorStore.getState().update('nodes', node.id, { color: c })} />
      ))}
    </div>
  )
}

/** One selected node (design 6.2): title, colour, start node, script lines and cues. */
export function NodeFields({ node }: { node: StoryNode }) {
  const [title, setTitle, flush] = useSavedText('nodes', node.id, 'title', node.title)
  const isStart = useEditor((s) => s.content.project?.startNodeId === node.id)
  const makeStart = () => void editorStore.getState().update('projects', node.projectId, { startNodeId: node.id })
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span>Title</span>
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={flush} />
      </label>
      <ColorSwatches node={node} />
      {isStart
        ? <p className="text-muted">This is the start node.</p>
        : <button type="button" className="btn self-start" onClick={makeStart}>Make start node</button>}
      <ScriptLines projectId={node.projectId} nodeId={node.id} />
      <Cues projectId={node.projectId} nodeId={node.id} />
    </div>
  )
}
