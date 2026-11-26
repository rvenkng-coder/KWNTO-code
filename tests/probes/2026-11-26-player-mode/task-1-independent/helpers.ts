import { content } from '../../../../frontend/src/features/editor/model/fixtures'
import { fromContent } from '../../../../frontend/src/features/editor/model/state'
import type { ProjectContent } from '../../../../frontend/src/backend'
import { buildStory, type PlayChoice, type PlayNode, type Story } from '../../../../frontend/src/features/player/story'
import { choose, startSession, type Session } from '../../../../frontend/src/features/player/session'

export const build = (over: Partial<ProjectContent>, media: Parameters<typeof buildStory>[1] = []): Story =>
  buildStory(fromContent(content(over)), media)

export const pn = (id: string, over: Partial<PlayNode> = {}): PlayNode =>
  ({ id, title: id, chapterId: 'c1', chapterTitle: 'One', lines: [], media: [], choices: [], ...over })

export const ch = (id: string, label: string, targetId: string | null): PlayChoice => ({ id, label, targetId })

export function story(nodes: PlayNode[], startId: string | null = nodes[0]?.id ?? null): Story {
  return { projectName: 'Story', startId, nodes: Object.fromEntries(nodes.map((n) => [n.id, n])) }
}

/** Starts the story and takes each choice in turn; throws when one is refused. */
export function walk(st: Story, ...choiceIds: string[]): Session {
  let session = startSession(st)
  if (session === null) throw new Error('no session')
  for (const id of choiceIds) {
    const next = choose(st, session, id)
    if (next === null) throw new Error(`choice ${id} refused`)
    session = next
  }
  return session
}
