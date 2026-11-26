import type { Chapter } from '../../../backend'

// What this browser shows of the chapter tabs (decision D10): closed tabs and widths. Never saved.

export interface TabsView {
  closed: ReadonlySet<string>
  widths: Readonly<Record<string, number>>
}
export const EMPTY_TABS: TabsView = { closed: new Set(), widths: {} }
export const TAB_MIN = 80
export const TAB_MAX = 320
export const TAB_DEFAULT = 160

export function closeTab(v: TabsView, id: string): TabsView {
  return { ...v, closed: new Set([...v.closed, id]) }
}

export function openTab(v: TabsView, id: string): TabsView {
  const closed = new Set(v.closed)
  closed.delete(id)
  return { ...v, closed }
}

export function setTabWidth(v: TabsView, id: string, width: number): TabsView {
  const clamped = Number.isNaN(width) ? TAB_DEFAULT : Math.min(TAB_MAX, Math.max(TAB_MIN, width))
  return { ...v, widths: { ...v.widths, [id]: clamped } }
}

/** Live chapters in order, minus the closed ones. `chapters` is already in position order. */
export function visibleTabs(chapters: Chapter[], v: TabsView): Chapter[] {
  return chapters.filter((c) => !c.deleted && !v.closed.has(c.id))
}

/**
 * The tab to show after `closedId` is closed. `visible` is the strip before the close.
 * Closing another tab keeps `activeId`; closing the active one picks the tab to its right,
 * else to its left, else none.
 */
export function activeAfterClose(visible: Chapter[], closedId: string, activeId: string | null): string | null {
  if (activeId !== closedId) return activeId
  const at = visible.findIndex((c) => c.id === closedId)
  return visible[at + 1]?.id ?? visible[at - 1]?.id ?? null
}
