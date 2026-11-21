import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { StoryNode } from '../../../backend/index.ts'
import { useOnline } from '../media/useOnline.ts'
import { LinkItem } from './LinkItem.tsx'
import { linksOf } from './linksList.ts'
import { TITLE_MAX, useLinksStore } from './useProjectLinks.ts'

// Links and other material on a node: a title and a web address each (plan 2026-11-21-node-links).
export function LinksSection({ node }: { node: StoryNode }) {
  const links = useLinksStore((s) => s.links)
  const error = useLinksStore((s) => s.error)
  const add = useLinksStore((s) => s.add)
  const remove = useLinksStore((s) => s.remove)
  const isOnline = useOnline()
  const [title, setTitle] = useState('')
  const [address, setAddress] = useState('')

  // An error belongs to the node it happened on. Moving to another node clears it; the first
  // render does not, so an error from opening the project stays visible.
  const shownNodeId = useRef(node.id)
  useEffect(() => {
    if (shownNodeId.current === node.id) return
    shownNodeId.current = node.id
    useLinksStore.getState().setError(null)
    setTitle('')
    setAddress('')
  }, [node.id])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (await add(node.id, title, address)) {
      setTitle('')
      setAddress('')
    }
  }

  return (
    <div data-testid="links-section" className="flex flex-col gap-2 border-t border-border pt-4">
      <h4 className="text-sm font-semibold">Links and other material</h4>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-1">
        <input className="field" aria-label="Link title" maxLength={TITLE_MAX} placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="field" aria-label="Link address" placeholder="https://" value={address} onChange={(e) => setAddress(e.target.value)} />
        <button type="submit" className="btn self-start text-sm" disabled={!isOnline}>Add link</button>
      </form>

      {!isOnline && (
        <p className="text-xs text-muted">Links need a connection. Try again when you are back online.</p>
      )}

      {error && (
        <div role="alert" className="text-xs text-danger">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {linksOf(links, node.id).map((l) => (
          <LinkItem key={l.id} link={l} onDelete={remove} />
        ))}
      </div>
    </div>
  )
}
