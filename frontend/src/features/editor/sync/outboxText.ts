import type { ContentKind } from '../../../backend'

// The outbox's backoff and the words the person sees (offline sync plan Task 1, D7).

export const BASE_DELAY_MS = 1000
export const MAX_DELAY_MS = 30000

/** The wait before send attempt `attempt` after an unreachable answer: 1, 2, 4 ... seconds, at most 30. */
export function nextDelay(attempt: number): number {
  if (attempt < 1) return BASE_DELAY_MS
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1))
}

export function statusText(online: boolean, waiting: number): string | null {
  if (online) return waiting > 0 ? 'Saving…' : null
  if (waiting === 0) return 'Offline'
  return `Offline, ${waiting} ${waiting === 1 ? 'change' : 'changes'} waiting`
}

export function failedText(count: number): string {
  return `${count} ${count === 1 ? 'change' : 'changes'} could not be saved`
}

const LABELS: Record<string, string> = {
  title: 'Title', color: 'Colour', x: 'Position', y: 'Position', width: 'Size', height: 'Size', deleted: 'In trash', character: 'Character',
  text: 'Text', sortOrder: 'Order', type: 'Cue type', label: 'Choice text', toNodeId: 'Choice target',
  name: 'Name', startNodeId: 'Start node', analyticsEnabled: 'Analytics', position: 'Tab order',
}

export function fieldLabel(_kind: ContentKind, field: string): string {
  return LABELS[field] ?? field
}
