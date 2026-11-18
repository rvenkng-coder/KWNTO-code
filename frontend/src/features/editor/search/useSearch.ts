import { useMemo, useState, type KeyboardEvent } from 'react'
import { searchNodes, type SearchHit } from '../model/search'
import { useEditor } from '../store/editorStore'

/** A query, its hits and the arrow-key position, shared by the header search and the link picker. */
export function useSearch(onChoose: (hit: SearchHit) => void, excludeChapterId?: string) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const content = useEditor((s) => s.content)
  const hits = useMemo(() => searchNodes(content, query, { excludeChapterId }), [content, query, excludeChapterId])
  const choose = (hit: SearchHit) => {
    setQuery('')
    setActive(0)
    onChoose(hit)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const moves: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 }
    const by = moves[e.key]
    if (by !== undefined && hits.length > 0) {
      e.preventDefault()
      setActive((a) => (a + by + hits.length) % hits.length)
    } else if (e.key === 'Enter' && hits[active] !== undefined) {
      e.preventDefault()
      choose(hits[active])
    } else if (e.key === 'Escape') {
      setQuery('')
      e.currentTarget.blur()
    }
  }
  const change = (q: string) => {
    setQuery(q)
    setActive(0)
  }
  return { query, change, hits, active, choose, onKeyDown, open: query.trim() !== '' }
}
