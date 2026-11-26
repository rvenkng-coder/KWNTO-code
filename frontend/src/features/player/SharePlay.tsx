import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectFile } from '../../backend'
import { Player } from './Player'
import { storyOfFile } from './shareStory'
import type { Story } from './story'
import { shareMediaSrc } from './useShareMediaSrc'

interface Props { file: ProjectFile; projectId: string; token: string; needsSignIn: boolean }

/** `Play` in the read-only viewer. The story is read at the click and kept while the player is open (plan D3), even when a live view re-reads the file. */
export function SharePlay({ file, projectId, token, needsSignIn }: Props) {
  const [story, setStory] = useState<Story | null>(null)
  const useMediaSrc = useMemo(() => shareMediaSrc(token, needsSignIn), [token, needsSignIn])
  const button = useRef<HTMLButtonElement | null>(null)
  const wasOpen = useRef(false)
  useEffect(() => {
    if (story === null && wasOpen.current) button.current?.focus()
    wasOpen.current = story !== null
  }, [story])
  return (
    <>
      <button ref={button} type="button" className="btn" onClick={() => setStory(storyOfFile(file, projectId))}>Play</button>
      {story !== null && <Player story={story} useMediaSrc={useMediaSrc} onClose={() => setStory(null)} />}
    </>
  )
}
