import type { PlayChoice, PlayNode, Story } from '../../../../frontend/src/features/player/story'
import { choose, startSession, type Session } from '../../../../frontend/src/features/player/session'

export function pnode(id: string, chapterId: string, choices: PlayChoice[] = [], title = id): PlayNode {
  return { id, title, chapterId, chapterTitle: `chapter ${chapterId}`, lines: [], media: [], choices }
}

export const go = (id: string, targetId: string | null, label = id): PlayChoice => ({ id, label, targetId })

export function story(nodes: PlayNode[], startId: string | null = nodes[0]?.id ?? null): Story {
  return { projectName: 'P', startId, nodes: Object.fromEntries(nodes.map((n) => [n.id, n])) }
}

/** Starts a session and follows the given choice ids; throws when one does not move. */
export function play(st: Story, ...choiceIds: string[]): Session {
  let session = startSession(st)
  if (session === null) throw new Error('no start')
  for (const id of choiceIds) {
    const next = choose(st, session, id)
    if (next === null) throw new Error(`cannot choose ${id}`)
    session = next
  }
  return session
}
