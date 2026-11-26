import { useEffect, useRef } from 'react'
import { PlayerMedia, type UseMediaSrc } from './PlayerMedia'
import type { Screen } from './session'
import type { Transition } from './usePlayer'

interface Props {
  screen: Screen
  transition: Transition
  moves: number
  note: string | null
  useMediaSrc: UseMediaSrc
  onChoose(choiceId: string): void
}

/** The node on screen (design 6.4): chapter name when it changes, title, screenplay lines, media, choices, or The End. */
export function PlayerScreen({ screen, transition, moves, note, useMediaSrc, onChoose }: Props) {
  const { node } = screen
  const region = useRef<HTMLDivElement | null>(null)
  // After every move the region takes focus and is announced; the first screen leaves focus where the dialog put it.
  useEffect(() => {
    if (moves > 0) region.current?.focus()
  }, [moves])
  return (
    <div
      key={moves}
      ref={region}
      tabIndex={-1}
      aria-live="polite"
      data-testid="player-step"
      data-transition={transition}
      className="player-step mx-auto flex w-full max-w-2xl flex-col gap-4 outline-none"
    >
      {screen.showChapter && (
        <p data-testid="player-chapter" className="text-sm uppercase tracking-widest text-muted">
          {node.chapterTitle}
        </p>
      )}
      <h2 data-testid="player-title" className="text-2xl">
        {node.title}
      </h2>
      <div className="flex flex-col gap-3">
        {node.lines.map((l, i) => (
          <p key={i} data-testid="player-line" className={l.character === '' ? 'player-action' : 'player-dialogue'}>
            {l.character !== '' && <span className="player-character">{l.character}</span>}
            <span>{l.text}</span>
          </p>
        ))}
      </div>
      {node.media.map((m) => (
        <PlayerMedia key={m.id} media={m} useMediaSrc={useMediaSrc} />
      ))}
      <div className="flex flex-col gap-2">
        {node.choices.map((c) => (
          <button
            key={c.id}
            type="button"
            data-testid="player-choice"
            className="btn text-left"
            onClick={() => onChoose(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      {note !== null && (
        <p data-testid="player-note" role="status" className="text-sm text-muted">
          {note}
        </p>
      )}
      {screen.isEnd && (
        <p data-testid="player-end" className="text-sm uppercase tracking-widest text-muted">
          The End
        </p>
      )}
    </div>
  )
}
