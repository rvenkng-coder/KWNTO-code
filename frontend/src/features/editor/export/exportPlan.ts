import type { Chapter } from '../../../backend'
import { liveChapters, liveNodes, type ContentState } from '../model/state'

export type ExportFormat = 'pdf' | 'docx' | 'jpg' | 'png'
export type ExportScope = 'chapter' | 'project'

/** One chapter's map as an image; width and height are image pixels. `small` when the ratio fell below 0.5. */
export interface MapImage { chapterTitle: string; dataUrl: string; width: number; height: number; small: boolean }

/** Space kept around the nodes' bounds, in map pixels. */
export const MAP_PADDING = 40

const MAX_SIDE = 8192
const MAX_AREA = 32_000_000
const MAX_RATIO = 2
const UNSAFE = /[\\/:*?"<>|]/g
const PART_LIMIT = 100

/** Images hold one chapter, so only PDF and Word offer the whole project (D5). */
export function scopesFor(format: ExportFormat): ExportScope[] {
  return format === 'pdf' || format === 'docx' ? ['chapter', 'project'] : ['chapter']
}

export function exportChapters(
  s: ContentState, scope: ExportScope, activeChapterId: string | null,
): { ok: true; chapters: Chapter[] } | { ok: false; message: string } {
  const chapters = liveChapters(s)
    .filter((c) => scope === 'project' || c.id === activeChapterId)
    .filter((c) => liveNodes(s, c.id).length > 0)
  if (chapters.length > 0) return { ok: true, chapters }
  const message = scope === 'project' ? 'This project has no nodes to export.' : 'This chapter has no nodes to export.'
  return { ok: false, message }
}

function cleanPart(text: string, fallback: string): string {
  const spaced = text.replace(/\s+/g, ' ')
  const printable = Array.from(spaced).filter((ch) => (ch.codePointAt(0) ?? 0) >= 32).join('')
  const cleaned = printable.replace(UNSAFE, '-').trim().replace(/^\.+|\.+$/g, '')
  const cut = Array.from(cleaned).slice(0, PART_LIMIT).join('')
  return cut === '' ? fallback : cut
}

export function exportFileName(projectName: string, chapterTitle: string | null, format: ExportFormat): string {
  const parts = [cleanPart(projectName, 'KWNTO map')]
  if (chapterTitle !== null) parts.push(cleanPart(chapterTitle, 'Untitled'))
  return `${parts.join(' - ')}.${format}`
}

/** Up to 2, lowered so the longest side is at most 8192 px and the area at most 32,000,000 px (D3). */
export function exportPixelRatio(width: number, height: number): number {
  if (width <= 0 || height <= 0) return MAX_RATIO
  return Math.min(MAX_RATIO, MAX_SIDE / Math.max(width, height), Math.sqrt(MAX_AREA / (width * height)))
}

export function isSmallText(ratio: number): boolean {
  return ratio < 0.5
}

/** The largest size with the same aspect that fits inside the box; may scale up. */
export function fitInto(
  width: number, height: number, box: { width: number; height: number },
): { width: number; height: number } {
  const scale = Math.min(box.width / width, box.height / height)
  return { width: width * scale, height: height * scale }
}
