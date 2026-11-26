import type { HistoryEntry } from './session'

/** The path so far, oldest first (plan D6): read-only. */
export function PlayerHistory({ entries }: { entries: HistoryEntry[] }) {
  return (
    <section className="flex flex-col gap-1">
      <h3>History</h3>
      <ol data-testid="player-history" className="flex list-decimal flex-col gap-1 pl-6">
        {entries.map((e, i) => (
          <li
            key={i}
            aria-current={e.current ? 'step' : undefined}
            className={e.current ? 'font-semibold' : 'text-muted'}
          >
            {e.text}
          </li>
        ))}
      </ol>
    </section>
  )
}
