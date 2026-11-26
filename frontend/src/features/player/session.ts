import type { PlayNode, Story } from './story'

// The path a player has taken (plan 2026-11-26-player-mode, Task 1). A session is never changed in
// place: every move returns a new one.

export interface Step { nodeId: string; viaChoiceId: string | null }
export interface Session { steps: Step[] }
export interface Screen { node: PlayNode; index: number; showChapter: boolean; isEnd: boolean; canGoBack: boolean }
export interface HistoryEntry { text: string; chapterTitle: string; current: boolean }

/** A session at the start node, or `null` when there is no start node to play from. */
export function startSession(story: Story): Session | null {
  if (story.startId === null || story.nodes[story.startId] === undefined) return null
  return { steps: [{ nodeId: story.startId, viaChoiceId: null }] }
}

function currentNode(story: Story, session: Session): PlayNode {
  const last = session.steps[session.steps.length - 1]
  const node = last === undefined ? undefined : story.nodes[last.nodeId]
  if (node === undefined) throw new Error('The session is not part of this story.')
  return node
}

/** One step on along a choice; `null` when the choice is unknown, empty or leads to a node outside the story. */
export function choose(story: Story, session: Session, choiceId: string): Session | null {
  const choice = currentNode(story, session).choices.find((c) => c.id === choiceId)
  if (choice === undefined || choice.targetId === null || story.nodes[choice.targetId] === undefined) return null
  return { steps: [...session.steps, { nodeId: choice.targetId, viaChoiceId: choiceId }] }
}

/** One step back; never below the start. */
export function back(session: Session): Session {
  return { steps: session.steps.length > 1 ? session.steps.slice(0, -1) : session.steps }
}

/** What the player shows now. */
export function screenOf(story: Story, session: Session): Screen {
  const node = currentNode(story, session)
  const index = session.steps.length - 1
  const prevStep = session.steps[index - 1]
  const prev = prevStep === undefined ? undefined : story.nodes[prevStep.nodeId]
  const isEnd = node.choices.every((c) => c.targetId === null)
  const showChapter = prev === undefined || prev.chapterId !== node.chapterId
  return { node, index, showChapter, isEnd, canGoBack: index > 0 }
}

/** The path as a list: the first node, then each choice taken and where it led. */
export function historyOf(story: Story, session: Session): HistoryEntry[] {
  return session.steps.map((step, i) => {
    const node = story.nodes[step.nodeId]
    const before = i === 0 ? undefined : story.nodes[session.steps[i - 1]!.nodeId]
    const choice = before?.choices.find((c) => c.id === step.viaChoiceId)
    const title = node?.title ?? ''
    return {
      text: choice === undefined ? title : `${choice.label} → ${title}`,
      chapterTitle: node?.chapterTitle ?? '',
      current: i === session.steps.length - 1,
    }
  })
}
