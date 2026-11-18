import type { Chapter } from '../../../backend'
import { newId } from '../model/ids'
import { insertAt } from '../model/sortOrder'
import { edits } from '../store/edits'
import { moveChapter } from './chapterMoves'

// What the chapter screens change, through `edits` (one undo step each). `ordered` is the live chapters in position order.

/** Adds `Chapter <n+1>` after the last one and returns its id. */
export async function addChapter(projectId: string, ordered: Chapter[]): Promise<string> {
  const id = newId()
  const placement = insertAt(ordered.map((c) => ({ id: c.id, order: c.position })), id, ordered.length)
  const position = placement.kind === 'one' ? placement.order : (placement.orders.find((o) => o.id === id)?.order ?? ordered.length + 1)
  await edits.group('Add chapter', async () => {
    // A renumber of the other chapters is rare (only after about 50 inserts in one gap).
    if (placement.kind === 'renumber') await renumberOthers(placement.orders, id)
    await edits.create('chapters', { id, projectId, title: `Chapter ${ordered.length + 1}`, position, deleted: false, version: 0 }, 'Add chapter')
  })
  return id
}

async function renumberOthers(orders: Array<{ id: string; order: number }>, exceptId: string): Promise<void> {
  await Promise.all(
    orders.filter((o) => o.id !== exceptId).map((o) => edits.update('chapters', o.id, { position: o.order }, 'Add chapter')),
  )
}

export function renameChapter(id: string, title: string): Promise<boolean> {
  return edits.update('chapters', id, { title }, 'Rename chapter')
}

export function trashChapter(id: string): Promise<boolean> {
  return edits.update('chapters', id, { deleted: true }, 'Move chapter to trash')
}

/** One update for a plain move; one per chapter whose position changed for a renumber. */
export async function shiftChapter(ordered: Chapter[], id: string, direction: 'left' | 'right'): Promise<void> {
  const move = moveChapter(ordered, id, direction)
  if (move === null) return
  if (move.kind === 'one') {
    await edits.update('chapters', id, { position: move.position }, 'Move chapter')
    return
  }
  const changed = move.positions.filter((p) => ordered.find((c) => c.id === p.id)?.position !== p.position)
  await edits.group('Move chapter', async () => {
    await Promise.all(changed.map((p) => edits.update('chapters', p.id, { position: p.position }, 'Move chapter')))
  })
}
