import type { Chapter } from '../../../backend'
import { newId } from '../model/ids'
import { insertAt } from '../model/sortOrder'
import { editorStore } from '../store/editorStore'
import { moveChapter } from './chapterMoves'

// What the chapter screens do to the store. `ordered` is the live chapters in position order.

/** Adds `Chapter <n+1>` after the last one and returns its id. */
export async function addChapter(projectId: string, ordered: Chapter[]): Promise<string> {
  const id = newId()
  const placement = insertAt(ordered.map((c) => ({ id: c.id, order: c.position })), id, ordered.length)
  const store = editorStore.getState()
  // A renumber of the other chapters is rare (only after about 50 inserts in one gap).
  if (placement.kind === 'renumber') await renumberOthers(placement.orders, id)
  const position = placement.kind === 'one' ? placement.order : (placement.orders.find((o) => o.id === id)?.order ?? ordered.length + 1)
  await store.create('chapters', { id, projectId, title: `Chapter ${ordered.length + 1}`, position, deleted: false, version: 0 })
  return id
}

async function renumberOthers(orders: Array<{ id: string; order: number }>, exceptId: string): Promise<void> {
  await Promise.all(
    orders.filter((o) => o.id !== exceptId).map((o) => editorStore.getState().update('chapters', o.id, { position: o.order })),
  )
}

export function renameChapter(id: string, title: string): Promise<boolean> {
  return editorStore.getState().update('chapters', id, { title })
}

export function trashChapter(id: string): Promise<boolean> {
  return editorStore.getState().update('chapters', id, { deleted: true })
}

/** One update for a plain move; one per chapter whose position changed for a renumber. */
export async function shiftChapter(ordered: Chapter[], id: string, direction: 'left' | 'right'): Promise<void> {
  const move = moveChapter(ordered, id, direction)
  if (move === null) return
  const store = editorStore.getState()
  if (move.kind === 'one') {
    await store.update('chapters', id, { position: move.position })
    return
  }
  const changed = move.positions.filter((p) => ordered.find((c) => c.id === p.id)?.position !== p.position)
  await Promise.all(changed.map((p) => store.update('chapters', p.id, { position: p.position })))
}
