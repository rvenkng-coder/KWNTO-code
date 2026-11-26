import { useEffect, useRef, useState } from 'react'
import { useMediaStore } from '../editor/media/useProjectMedia'
import { editorStore } from '../editor/store/editorStore'
import { Player } from './Player'
import { buildStory, type Story } from './story'
import { useEditorMediaSrc } from './useEditorMediaSrc'

function storyNow(): Story {
  const media = useMediaStore
    .getState()
    .media.filter((m) => m.removedAt === '')
    .map((m) => ({ id: m.id, nodeId: m.nodeId, title: m.title, kind: m.kind }))
  return buildStory(editorStore.getState().content, media)
}

/** The editor's `Play` button. The story is read when it is clicked and does not change while the player is open (plan D3). */
export function EditorPlay() {
  const [story, setStory] = useState<Story | null>(null)
  const button = useRef<HTMLButtonElement | null>(null)
  const wasOpen = useRef(false)
  // Focus goes back to the button once the dialog is gone: while it is still mounted its focus guard would take focus back.
  useEffect(() => {
    if (story === null && wasOpen.current) button.current?.focus()
    wasOpen.current = story !== null
  }, [story])
  return (
    <>
      <button ref={button} type="button" className="btn" onClick={() => setStory(storyNow())}>
        Play
      </button>
      {story !== null && <Player story={story} useMediaSrc={useEditorMediaSrc} onClose={() => setStory(null)} />}
    </>
  )
}
