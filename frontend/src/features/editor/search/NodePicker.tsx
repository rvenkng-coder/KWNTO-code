import { useState } from 'react'
import type { StoryNode } from '../../../backend'
import { newId } from '../model/ids'
import type { SearchHit } from '../model/search'
import { editorStore } from '../store/editorStore'
import { edits } from '../store/edits'
import { SearchResults } from './SearchResults'
import { useSearch } from './useSearch'

function linkTo(node: StoryNode, hit: SearchHit): void {
  const exists = Object.values(editorStore.getState().content.connections)
    .some((c) => c.fromNodeId === node.id && c.toNodeId === hit.nodeId)
  if (exists) return
  const connection = { id: newId(), projectId: node.projectId, fromNodeId: node.id, toNodeId: hit.nodeId, label: '', version: 0 }
  void edits.create('connections', connection, 'Link to another chapter')
}

/** "Link to a node in another chapter" (design 6.1): a search over the other chapters; choosing a node connects to it. */
export function NodePicker({ node }: { node: StoryNode }) {
  const [open, setOpen] = useState(false)
  const s = useSearch((hit) => {
    linkTo(node, hit)
    setOpen(false)
  }, node.chapterId)
  if (!open) return <button type="button" className="btn self-start" onClick={() => setOpen(true)}>Link to another chapter</button>
  return (
    <div className="flex flex-col gap-1">
      <input className="field" aria-label="Find a node" placeholder="Find a node in another chapter" autoFocus
        value={s.query} onChange={(e) => s.change(e.target.value)} onKeyDown={s.onKeyDown} />
      {s.open && <SearchResults testId="picker-results" hits={s.hits} active={s.active} onChoose={s.choose} />}
      <button type="button" className="btn self-start" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  )
}
