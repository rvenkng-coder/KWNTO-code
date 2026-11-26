import { useMemo, useState } from 'react'
import type { StoryNode } from '../../../backend'
import { choicesOf, newChoice } from '../model/choices'
import { NodePicker } from '../search/NodePicker'
import { useEditor } from '../store/editorStore'
import { edits } from '../store/edits'
import { ChoiceRow } from './ChoiceRow'
import { AddButton } from './RowControls'
import { SectionLabel } from './SectionLabel'

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
      <SectionLabel>Choices</SectionLabel>
      <ul className="flex flex-col gap-2">
        {list.map((c) => (
          <ChoiceRow key={c.id} choice={c} autoFocus={c.id === focusId} />
        ))}
      </ul>
      <AddButton name="Add choice" onClick={add} />
      <NodePicker key={node.id} node={node} />
    </section>
  )
}
