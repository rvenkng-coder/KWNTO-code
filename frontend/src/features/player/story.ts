import type { MediaKind } from '../../backend/media-types'
import { choicesOf } from '../editor/model/choices'
import { effectiveStart } from '../editor/model/markers'
import { linesOf, liveNodes, type ContentState } from '../editor/model/state'

// What a player sees of a project (plan 2026-11-26-player-mode, Task 1): live nodes with their
// lines, media and choices. Cues, lighting notes, comments and links are left out on purpose.

export interface StoryMediaInput {
  id: string
  nodeId: string
  title: string
  kind: MediaKind
}
export interface PlayLine {
  character: string
  text: string
}
export interface PlayMedia {
  id: string
  title: string
  kind: MediaKind
}
export interface PlayChoice {
  id: string
  label: string
  targetId: string | null
}
export interface PlayNode {
  id: string
  title: string
  chapterId: string
  chapterTitle: string
  lines: PlayLine[]
  media: PlayMedia[]
  choices: PlayChoice[]
}
export interface Story {
  projectName: string
  startId: string | null
  nodes: Record<string, PlayNode>
}

const UNTITLED = 'Untitled'

function cleanTitle(title: string): string {
  const t = title.trim()
  return t === '' ? UNTITLED : t
}

/** The story a player sees, built from the editor's state and the project's media. */
export function buildStory(s: ContentState, media: StoryMediaInput[]): Story {
  const titleOf = (targetId: string | null): string => {
    const target = targetId === null ? undefined : s.nodes[targetId]
    return target === undefined ? UNTITLED : cleanTitle(target.title)
  }
  const nodes: Record<string, PlayNode> = {}
  for (const n of liveNodes(s)) {
    nodes[n.id] = {
      id: n.id,
      title: cleanTitle(n.title),
      chapterId: n.chapterId,
      chapterTitle: cleanTitle(s.chapters[n.chapterId]?.title ?? ''),
      lines: linesOf(s, n.id)
        .filter((l) => l.character.trim() !== '' || l.text.trim() !== '')
        .map((l) => ({ character: l.character.trim(), text: l.text })),
      media: media.filter((m) => m.nodeId === n.id).map((m) => ({ id: m.id, title: m.title, kind: m.kind })),
      choices: choicesOf(s, n.id).map((c) => {
        const label = c.label.trim() !== '' ? c.label.trim() : titleOf(c.toNodeId)
        return { id: c.id, label, targetId: c.toNodeId }
      }),
    }
  }
  return { projectName: s.project?.name ?? '', startId: effectiveStart(s), nodes }
}
