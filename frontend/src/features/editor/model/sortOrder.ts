// Decimal sort order (plan decision D4): insert between two neighbours takes the midpoint,
// at an end takes neighbour +- 1. When floats run out of room the whole list is renumbered.

export function sortOrderBetween(before: number | null, after: number | null): number | null {
  if ((before !== null && !Number.isFinite(before)) || (after !== null && !Number.isFinite(after))) return null
  if (before === null && after === null) return 1
  if (before === null) return (after as number) - 1
  if (after === null) return before + 1
  const mid = (before + after) / 2
  if (!(mid > before && mid < after)) return null
  return mid
}

export function renumber(count: number): number[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => i + 1)
}

export function byOrder<T extends { sortOrder: number; id: string }>(a: T, b: T): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

// Chapter tabs use `position`, lines and cues `sortOrder`; callers map to `order`.
export interface Ordered { id: string; order: number }
export type Placement = { kind: 'one'; id: string; order: number } | { kind: 'renumber'; orders: Ordered[] }

// `result` is the list as it will be shown; the item at `index` is the one being placed.
function placeInResult(result: Ordered[], index: number): Placement {
  const id = result[index].id
  const order = sortOrderBetween(result[index - 1]?.order ?? null, result[index + 1]?.order ?? null)
  if (order !== null) return { kind: 'one', id, order }
  const orders = renumber(result.length).map((n, i) => ({ id: result[i].id, order: n }))
  return { kind: 'renumber', orders }
}

export function placeAt(list: Ordered[], id: string, index: number): Placement | null {
  const from = list.findIndex((item) => item.id === id)
  if (from === -1 || !Number.isInteger(index) || index < 0 || index > list.length - 1 || index === from) return null
  const result = list.filter((item) => item.id !== id)
  result.splice(index, 0, list[from])
  return placeInResult(result, index)
}

export function insertAt(list: Ordered[], id: string, index: number): Placement {
  const at = Math.min(list.length, Math.max(0, index))
  const result = [...list]
  result.splice(at, 0, { id, order: 0 })
  return placeInResult(result, at)
}
