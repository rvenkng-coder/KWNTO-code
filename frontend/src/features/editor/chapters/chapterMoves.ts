import type { Chapter } from '../../../backend'
import { placeAt } from '../model/sortOrder'

export type ChapterMove =
  { kind: 'one'; id: string; position: number } | { kind: 'renumber'; positions: { id: string; position: number }[] }

/** Moves a chapter one place; `ordered` is the chapters in position order. Null when it cannot move. */
export function moveChapter(ordered: Chapter[], id: string, direction: 'left' | 'right'): ChapterMove | null {
  const at = ordered.findIndex((c) => c.id === id)
  if (at === -1) return null
  const list = ordered.map((c) => ({ id: c.id, order: c.position }))
  const placement = placeAt(list, id, direction === 'left' ? at - 1 : at + 1)
  if (placement === null) return null
  if (placement.kind === 'one') return { kind: 'one', id, position: placement.order }
  return { kind: 'renumber', positions: placement.orders.map((o) => ({ id: o.id, position: o.order })) }
}
