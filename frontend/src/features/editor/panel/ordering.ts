import type { Ordered, Placement } from '../model/sortOrder'

// Lines and cues are ordered by `sortOrder` (plan D4). A placement from `insertAt` or `placeAt`
// becomes the sort orders to write: one record, or after a renumber only the records whose
// order changed (a record not in the list yet, the one being inserted, is always written).

export interface Sorted {
  id: string
  sortOrder: number
}

export const asOrdered = (list: Sorted[]): Ordered[] => list.map((r) => ({ id: r.id, order: r.sortOrder }))

export function orderWrites(list: Sorted[], placement: Placement): Ordered[] {
  if (placement.kind === 'one') return [{ id: placement.id, order: placement.order }]
  const current = new Map(list.map((r) => [r.id, r.sortOrder]))
  return placement.orders.filter((o) => current.get(o.id) !== o.order)
}
