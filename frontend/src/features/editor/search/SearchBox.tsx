import { jumpToNode } from './jump'
import { SearchResults } from './SearchResults'
import { useSearch } from './useSearch'

/** Header search (design 6.1): finds a node by title in every chapter and jumps to it. Ctrl/⌘+K focuses it. */
export function SearchBox() {
  const s = useSearch((hit) => jumpToNode(hit.nodeId))
  return (
    <div className="relative max-w-sm">
      <input
        data-testid="search-input" type="search" className="field w-full" aria-label="Search nodes" placeholder="Search nodes (Ctrl+K)"
        value={s.query} onChange={(e) => s.change(e.target.value)} onKeyDown={s.onKeyDown} onBlur={() => s.change('')}
      />
      {s.open && (
        <div className="panel absolute left-0 right-0 top-full z-20 mt-1">
          <SearchResults testId="search-results" hits={s.hits} active={s.active} onChoose={s.choose} />
        </div>
      )}
    </div>
  )
}
