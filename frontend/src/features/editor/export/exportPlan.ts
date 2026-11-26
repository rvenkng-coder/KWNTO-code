import type { Chapter } from '../../../backend'
import { liveChapters, liveNodes, type ContentState } from '../model/state'

export type ExportFormat = 'pdf' | 'docx' | 'jpg' | 'png'
export type ExportScope = 'chapter' | 'project'

/** One chapter's map as an image; width and height are image pixels. `small` when the ratio fell below 0.5. */
export interface MapImage {
  chapterTitle: string
  dataUrl: string
  width: number
  height: number
  small: boolean
}

/** Space kept around the nodes' bounds, in map pixels. */
export const MAP_PADDING = 40

const MAX_SIDE = 8192
const MAX_AREA = 32_000_000
const MAX_RATIO = 2
const UNSAFE = /[\\/:*?"<>|]/g
const PART_LIMIT = 100
// Two parts, a separator and an extension must stay under the 255 bytes most file systems allow.
const PART_BYTES = 120
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
const EDGES = /^[\s.]+|[\s.]+$/g

/** Images hold one chapter, so only PDF and Word offer the whole project (D5). */
export function scopesFor(format: ExportFormat): ExportScope[] {
  return format === 'pdf' || format === 'docx' ? ['chapter', 'project'] : ['chapter']
}

export function exportChapters(
  s: ContentState,
  scope: ExportScope,
  activeChapterId: string | null,
): { ok: true; chapters: Chapter[]; skipped: number } | { ok: false; message: string } {
  const wanted = liveChapters(s).filter((c) => scope === 'project' || c.id === activeChapterId)
  const chapters = wanted.filter((c) => liveNodes(s, c.id).length > 0)
  if (chapters.length > 0) return { ok: true, chapters, skipped: wanted.length - chapters.length }
  const message = scope === 'project' ? 'This project has no nodes to export.' : 'This chapter has no nodes to export.'
  return { ok: false, message }
}

/** The longest start of `text` that is at most `limit` characters and `bytes` UTF-8 bytes, cut on a whole character. */
function cutTo(text: string, limit: number, bytes: number): string {
  const encoder = new TextEncoder()
  let out = ''
  let size = 0
  for (const ch of Array.from(text).slice(0, limit)) {
    size += encoder.encode(ch).length
    if (size > bytes) break
    out += ch
  }
  return out
}

function cleanPart(text: string, fallback: string): string {
  const spaced = text.replace(/\s+/g, ' ')
  const printable = Array.from(spaced)
    .filter((ch) => (ch.codePointAt(0) ?? 0) >= 32)
    .join('')
  const cleaned = printable.replace(UNSAFE, '-').replace(EDGES, '')
  const cut = cutTo(cleaned, PART_LIMIT, PART_BYTES).replace(EDGES, '')
  return cut === '' ? fallback : cut
}

export function exportFileName(projectName: string, chapterTitle: string | null, format: ExportFormat): string {
  const parts = [cleanPart(projectName, 'KWNTO map')]
  if (chapterTitle !== null) parts.push(cleanPart(chapterTitle, 'Untitled'))
  const stem = parts.join(' - ')
  // Windows will not save a file whose whole name is a device name.
  return `${RESERVED.test(stem) ? '_' : ''}${stem}.${format}`
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
  width: number,
  height: number,
  box: { width: number; height: number },
): { width: number; height: number } {
  const scale = Math.min(box.width / width, box.height / height)
  return { width: width * scale, height: height * scale }
}
