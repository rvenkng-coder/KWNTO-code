import type { SearchHit } from '../model/search'

interface Props { testId: string; hits: SearchHit[]; active: number; onChoose(hit: SearchHit): void }

/** Search hits as buttons, `Title · Chapter`; the active one is marked for the arrow keys. */
export function SearchResults({ testId, hits, active, onChoose }: Props) {
  if (hits.length === 0) return <p className="text-muted">No node found.</p>
  return (
    <ul data-testid={testId} className="flex flex-col gap-1">
      {hits.map((h, i) => (
        <li key={h.nodeId}>
          <button
            type="button"
            className={`w-full truncate rounded-base px-2 py-1 text-left ${i === active ? 'bg-accent text-white' : 'hover:bg-bg'}`}
            // Keeps the focus in the box, so the list does not close before the click lands.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChoose(h)}
          >
            {h.title} · {h.chapterTitle}
          </button>
        </li>
      ))}
    </ul>
  )
}
