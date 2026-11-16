import { useMemo } from 'react'
import type { StoryNode } from '../../../backend'
import { crossLinksOf } from '../model/flow'
import { NodePicker } from '../search/NodePicker'
import { useEditor } from '../store/editorStore'
import { edits } from '../store/edits'

/** The node's links into other chapters, each with Remove, and the picker that adds one. */
export function CrossLinks({ node }: { node: StoryNode }) {
  const content = useEditor((s) => s.content)
  const links = useMemo(() => crossLinksOf(content, node.id), [content, node.id])
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold">Links to other chapters</h3>
      {links.length > 0 && (
        <ul className="flex flex-col gap-1">
          {links.map((l) => (
            <li key={l.connectionId} className="flex items-center justify-between gap-2">
              <span className="truncate">{l.text}</span>
              <button type="button" className="btn" onClick={() => void edits.remove('connections', l.connectionId, 'Remove link')}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <NodePicker key={node.id} node={node} />
    </section>
  )
}
