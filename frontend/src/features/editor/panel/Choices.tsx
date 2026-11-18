import { useMemo, useState } from 'react'
import type { StoryNode } from '../../../backend'
import { choicesOf, newChoice } from '../model/choices'
import { NodePicker } from '../search/NodePicker'
import { useEditor } from '../store/editorStore'
import { edits } from '../store/edits'
import { ChoiceRow } from './ChoiceRow'

/** The node's choices in the order the card shows them (design goal 1), Add choice, and the cross-chapter picker. */
export function Choices({ node }: { node: StoryNode }) {
  const content = useEditor((s) => s.content)
  const list = useMemo(() => choicesOf(content, node.id), [content, node.id])
  const [focusId, setFocusId] = useState<string | null>(null)
  const add = () => {
    const choice = newChoice(node.projectId, node.id, null, new Date().toISOString())
    setFocusId(choice.id)
    void edits.create('connections', choice, 'Add choice')
  }
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold">Choices</h3>
      <ul className="flex flex-col gap-2">
        {list.map((c) => <ChoiceRow key={c.id} choice={c} autoFocus={c.id === focusId} />)}
      </ul>
      <button type="button" className="btn self-start" onClick={add}>Add choice</button>
      <NodePicker key={node.id} node={node} />
    </section>
  )
}
