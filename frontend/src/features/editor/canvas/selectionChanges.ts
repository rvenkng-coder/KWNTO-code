// The canvas takes the selection from React Flow only from its `select` changes, which come from
// the person (click, Ctrl-click, box select, pane click). React Flow's onSelectionChange also
// reports selections the canvas itself pushed in, one update late, so a selection made from
// outside (search, a cross-chapter tag) and that echo flipped back and forth for ever.

export interface SelectionValue { nodeIds: string[]; connectionId: string | null }
// React Flow's NodeChange and EdgeChange, reduced to what a select change carries (an add change has no id).
type Change = { type: string; id?: string; selected?: boolean }
type Select = { type: 'select'; id: string; selected?: boolean }

const selects = (changes: Change[]): Select[] => changes.filter((c): c is Select => c.type === 'select' && typeof c.id === 'string')

/**
 * The selection after React Flow's node and edge changes, or null when none of them is a select
 * change. `shown` (the canvas's node ids) drops nodes of another chapter left selected after a tab switch.
 */
export function fromSelectChanges(
  current: SelectionValue, nodeChanges: Change[], edgeChanges: Change[], shown?: Set<string>,
): SelectionValue | null {
  const nodes = selects(nodeChanges)
  const edges = selects(edgeChanges)
  if (nodes.length === 0 && edges.length === 0) return null
  const ids = new Set(current.nodeIds.filter((id) => shown === undefined || shown.has(id)))
  for (const c of nodes) {
    if (c.selected === true) ids.add(c.id)
    else ids.delete(c.id)
  }
  let connectionId = current.connectionId
  for (const c of edges) {
    if (c.selected === true) connectionId = c.id
    else if (c.id === connectionId) connectionId = null
  }
  const nodeIds = [...ids]
  return { nodeIds, connectionId: nodeIds.length === 0 ? connectionId : null }
}
