import { choicesOf, duplicateChoiceMessage, hasChoiceTo, newChoice } from '../model/choices'
import { NEW_CHOICE_HANDLE } from '../model/flow'
import { editorStore } from '../store/editorStore'
import { edits } from '../store/edits'

// What a drag between handles does (editor cards design, goal 1): a choice's own dot links
// or re-links that choice, the "+" makes a new choice already linked. A second choice to
// the same node is refused with the message (F3) and nothing is saved.

function refuseDuplicate(toId: string): void {
  const title = editorStore.getState().content.nodes[toId]?.title ?? ''
  editorStore.setState({ error: duplicateChoiceMessage(title) })
}

/** Links an existing choice to `toId` ('Link choice'); refuses a duplicate. Returns whether it saved. */
export function linkChoice(choiceId: string, toId: string): boolean {
  const content = editorStore.getState().content
  const choice = content.connections[choiceId]
  if (choice === undefined) return false
  if (hasChoiceTo(content, choice.fromNodeId, toId, choiceId)) {
    refuseDuplicate(toId)
    return false
  }
  void edits.update('connections', choiceId, { toNodeId: toId }, 'Link choice')
  return true
}

/** A drag from `sourceHandle` on `fromId` to `toId`: creates (NEW_CHOICE_HANDLE) or re-links (choice-<id>); refuses a duplicate with the banner. */
export function connectChoice(projectId: string, fromId: string, sourceHandle: string | null, toId: string): void {
  const content = editorStore.getState().content
  if (sourceHandle === NEW_CHOICE_HANDLE) {
    if (hasChoiceTo(content, fromId, toId)) return refuseDuplicate(toId)
    void edits.create('connections', newChoice(projectId, fromId, toId, new Date().toISOString()), 'Add choice')
    return
  }
  const id = sourceHandle?.startsWith('choice-') === true ? sourceHandle.slice('choice-'.length) : null
  if (id !== null && choicesOf(content, fromId).some((c) => c.id === id)) linkChoice(id, toId)
}
