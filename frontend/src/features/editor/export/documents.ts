import { fitInto, type MapImage } from './exportPlan'

const PDF_MARGIN = 36
const PDF_HEADING = 14
const HEADING_GAP = 10
const WORD_IMAGE_BOX = { width: 1026, height: 640 }
const WORD_MARGIN = 720
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function dataUrlBytes(dataUrl: string): Uint8Array<ArrayBuffer> {
  const match = /^data:[^;,]*;base64,(.*)$/s.exec(dataUrl)
  const payload = match?.[1]
  if (payload === undefined) throw new Error('Not a data URL')
  return Uint8Array.from(atob(payload), (ch) => ch.charCodeAt(0))
}

function pageOrientation(map: MapImage): 'landscape' | 'portrait' {
  const orientation = map.width >= map.height ? 'landscape' : 'portrait'
  return orientation
}

// The same fallbacks as the file name (exportFileName), so a page and its file agree.
const heading = (projectName: string, map: MapImage) =>
  `${projectName.trim() === '' ? 'KWNTO map' : projectName} - ${map.chapterTitle.trim() === '' ? 'Untitled' : map.chapterTitle}`

const isLatin1 = (text: string): boolean => Array.from(text).every((ch) => (ch.codePointAt(0) ?? 0) <= 0xff)
const HEADING_SCALE = 3

/**
 * jsPDF's built-in font draws Latin-1 only, so a heading in another script (CJK, Cyrillic, emoji) is
 * drawn into a picture with the browser's own fonts. Null outside a browser, where the text is used.
 */
function headingPicture(text: string): { dataUrl: string; width: number; height: number } | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (ctx === null) return null
  const font = `${PDF_HEADING * HEADING_SCALE}px sans-serif`
  ctx.font = font
  canvas.width = Math.max(1, Math.ceil(ctx.measureText(text).width))
  canvas.height = Math.ceil(PDF_HEADING * HEADING_SCALE * 1.4)
  ctx.font = font
  ctx.fillStyle = '#000000'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 0, canvas.height / 2)
  return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width / HEADING_SCALE, height: canvas.height / HEADING_SCALE }
}

export async function buildPdf(projectName: string, maps: MapImage[]): Promise<Blob> {
  const first = maps[0]
  if (first === undefined) throw new Error('Nothing to export.')
  // PERF: What: load jsPDF only when a PDF export starts. Why: the library is large and most
  // sessions never export, so the editor's first load stays small (D1). Trade-off: the first
  // export waits for one extra download.
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: pageOrientation(first), unit: 'pt', format: 'a4' })
  maps.forEach((map, i) => {
    const orientation = pageOrientation(map)
    if (i > 0) doc.addPage('a4', orientation)
    const width = doc.internal.pageSize.getWidth()
    const height = doc.internal.pageSize.getHeight()
    doc.setFontSize(PDF_HEADING)
    const text = heading(projectName, map)
    const picture = isLatin1(text) ? null : headingPicture(text)
    if (picture === null) {
      doc.text(text, PDF_MARGIN, PDF_MARGIN + PDF_HEADING)
    } else {
      const size = fitInto(picture.width, picture.height, { width: width - 2 * PDF_MARGIN, height: picture.height })
      doc.addImage(picture.dataUrl, 'PNG', PDF_MARGIN, PDF_MARGIN, size.width, size.height)
    }
    const top = PDF_MARGIN + PDF_HEADING + HEADING_GAP
    const size = fitInto(map.width, map.height, { width: width - 2 * PDF_MARGIN, height: height - PDF_MARGIN - top })
    doc.addImage(map.dataUrl, 'PNG', PDF_MARGIN, top, size.width, size.height)
  })
  return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' })
}

export async function buildDocx(projectName: string, maps: MapImage[]): Promise<Blob> {
  if (maps.length === 0) throw new Error('Nothing to export.')
  // PERF: What: load docx only when a Word export starts. Why: same as the PDF builder (D1).
  // Trade-off: the first export waits for one extra download.
  const { Document, HeadingLevel, ImageRun, Packer, PageOrientation, Paragraph } = await import('docx')
  const children = maps.flatMap((map, i) => {
    const size = fitInto(map.width, map.height, WORD_IMAGE_BOX)
    return [
      new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: i > 0, text: heading(projectName, map) }),
      new Paragraph({
        children: [new ImageRun({
          type: 'png', data: dataUrlBytes(map.dataUrl),
          transformation: { width: Math.round(size.width), height: Math.round(size.height) },
        })],
      }),
    ]
  })
  const margin = WORD_MARGIN
  const doc = new Document({
    sections: [{
      properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: margin, right: margin, bottom: margin, left: margin } } },
      children,
    }],
  })
  const base64 = await Packer.toBase64String(doc)
  return new Blob([dataUrlBytes(`data:;base64,${base64}`)], { type: DOCX_TYPE })
}
