import type { Cue, ScriptLine } from '../../../backend'
import { newId } from '../model/ids'
import { insertAt, placeAt } from '../model/sortOrder'
import { edits } from '../store/edits'
import { asOrdered, orderWrites } from './ordering'

// Adding and moving script lines and cues of one node. New records get their place from
// `insertAt`, moves from `placeAt`; a renumber sends one update per record that changed.

type RowKind = 'script_lines' | 'cues'
type RowOf<K extends RowKind> = K extends 'script_lines' ? ScriptLine : Cue

const NAMES = { script_lines: 'line', cues: 'cue' } as const

async function writeOrders(kind: RowKind, writes: { id: string; order: number }[], skip: string | null, label: string): Promise<void> {
  await Promise.all(writes.filter((w) => w.id !== skip).map((w) => edits.update(kind, w.id, { sortOrder: w.order }, label)))
}

/** Makes a new record at `index` among `rows` and returns its id. `make` fills in everything but the id and order. */
export async function insertRow<K extends RowKind>(
  kind: K, rows: RowOf<K>[], index: number, make: (id: string, sortOrder: number) => RowOf<K>,
): Promise<string> {
  const id = newId()
  const writes = orderWrites(rows, insertAt(asOrdered(rows), id, index))
  const own = writes.find((w) => w.id === id)
  const label = `Add ${NAMES[kind]}`
  await edits.group(label, async () => {
    await edits.create(kind, make(id, own === undefined ? 1 : own.order) as never, label)
    await writeOrders(kind, writes, id, label)
  })
  return id
}

/** Moves the record `id` to `index` among `rows`; nothing happens at the ends of the list. */
export async function moveRow(kind: RowKind, rows: (ScriptLine | Cue)[], id: string, index: number): Promise<void> {
  const placement = placeAt(asOrdered(rows), id, index)
  if (placement === null) return
  const label = `Move ${NAMES[kind]}`
  await edits.group(label, () => writeOrders(kind, orderWrites(rows, placement), null, label))
}
