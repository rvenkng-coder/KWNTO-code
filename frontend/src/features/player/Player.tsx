import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFocusGuard, useModalKeys } from '../editor/export/useModalKeys'
import { PlayerHistory } from './PlayerHistory'
import type { UseMediaSrc } from './PlayerMedia'
import { PlayerScreen } from './PlayerScreen'
import type { Story } from './story'
import { usePlayer } from './usePlayer'

export type { MediaSrc, UseMediaSrc } from './PlayerMedia'

export const NOTHING_TO_PLAY = 'This project has no start node, so there is nothing to play yet.'

interface PlayerProps { story: Story; useMediaSrc: UseMediaSrc; onClose(): void }

/** Player Mode (design 6.4): a modal over the whole window that plays the story from its start node. */
export function Player({ story, useMediaSrc, onClose }: PlayerProps) {
  const player = usePlayer(story)
  const [showHistory, setShowHistory] = useState(false)
  const box = useRef<HTMLDivElement | null>(null)
  const onKeyDown = useModalKeys(box, false, onClose)
  useFocusGuard(box)
  const { screen } = player
  return createPortal(
    <div ref={box} tabIndex={-1} onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-label="Player"
      className="fixed inset-0 z-50 flex flex-col bg-bg text-text outline-none">
      <div className="flex items-center gap-2 border-b border-border bg-panel p-3">
        <span className="mr-auto font-semibold">{story.projectName}</span>
        <button type="button" className="btn" disabled={screen === null || !screen.canGoBack} onClick={player.back}>Back</button>
        <button type="button" className="btn" disabled={screen === null} onClick={player.restart}>Restart</button>
        <button type="button" className="btn" aria-expanded={showHistory} disabled={screen === null} onClick={() => setShowHistory((v) => !v)}>History</button>
        <button type="button" className="btn-primary" onClick={onClose}>Close</button>
      </div>
      <div className="flex min-h-0 flex-1 gap-4 overflow-y-auto p-6">
        <div className="flex-1">
          {screen === null
            ? <p role="status" className="mx-auto max-w-2xl">{NOTHING_TO_PLAY}</p>
            : <PlayerScreen screen={screen} transition={player.transition} moves={player.moves} note={player.note} useMediaSrc={useMediaSrc} onChoose={player.choose} />}
        </div>
        {showHistory && screen !== null && <aside className="panel w-64 shrink-0 self-start"><PlayerHistory entries={player.history} /></aside>}
      </div>
    </div>,
    document.body,
  )
}
