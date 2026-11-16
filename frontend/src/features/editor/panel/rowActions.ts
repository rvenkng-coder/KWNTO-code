import type { Cue, ScriptLine } from '../../../backend'
import { newId } from '../model/ids'
import { insertAt, placeAt } from '../model/sortOrder'
import { editorStore } from '../store/editorStore'
import { asOrdered, orderWrites } from './ordering'

// Adding and moving script lines and cues of one node. New records get their place from
// `insertAt`, moves from `placeAt`; a renumber sends one update per record that changed.

type RowKind = 'script_lines' | 'cues'
type RowOf<K extends RowKind> = K extends 'script_lines' ? ScriptLine : Cue

async function writeOrders(kind: RowKind, writes: { id: string; order: number }[], skip: string | null): Promise<void> {
  const store = editorStore.getState()
  await Promise.all(writes.filter((w) => w.id !== skip).map((w) => store.update(kind, w.id, { sortOrder: w.order })))
}

/** Makes a new record at `index` among `rows` and returns its id. `make` fills in everything but the id and order. */
export async function insertRow<K extends RowKind>(
  kind: K, rows: RowOf<K>[], index: number, make: (id: string, sortOrder: number) => RowOf<K>,
): Promise<string> {
  const id = newId()
  const writes = orderWrites(rows, insertAt(asOrdered(rows), id, index))
  const own = writes.find((w) => w.id === id)
  await editorStore.getState().create(kind, make(id, own === undefined ? 1 : own.order) as never)
  await writeOrders(kind, writes, id)
  return id
}

/** Moves the record `id` to `index` among `rows`; nothing happens at the ends of the list. */
export async function moveRow(kind: RowKind, rows: (ScriptLine | Cue)[], id: string, index: number): Promise<void> {
  const placement = placeAt(asOrdered(rows), id, index)
  if (placement === null) return
  await writeOrders(kind, orderWrites(rows, placement), null)
}
