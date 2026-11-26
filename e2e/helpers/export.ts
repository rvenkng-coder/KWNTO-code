import { type Download, type Page } from '@playwright/test'

export const exportButton = (page: Page) => page.getByRole('button', { name: 'Export map', exact: true })
export const exportDialog = (page: Page) => page.getByRole('dialog', { name: 'Export map' })

/** Opens the Export map dialog and picks a format and scope without exporting. */
export async function openExport(
  page: Page,
  format?: 'PDF' | 'Word' | 'JPG' | 'PNG',
  scope?: 'Current chapter' | 'Whole project',
): Promise<void> {
  await exportButton(page).click()
  const dialog = exportDialog(page)
  if (format !== undefined) await dialog.getByRole('radio', { name: format, exact: true }).check()
  if (scope !== undefined) await dialog.getByRole('radio', { name: scope, exact: true }).check()
}

/** Opens the dialog, picks, clicks `Export` and waits for the download. */
export async function exportMap(
  page: Page,
  format: 'PDF' | 'Word' | 'JPG' | 'PNG',
  scope: 'Current chapter' | 'Whole project',
): Promise<Download> {
  await openExport(page, format, scope)
  const download = page.waitForEvent('download')
  await exportDialog(page).getByRole('button', { name: 'Export', exact: true }).click()
  return download
}

export async function downloadBytes(d: Download): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of await d.createReadStream()) chunks.push(Buffer.from(chunk as Uint8Array))
  return Buffer.concat(chunks)
}

/** Width and height of a PNG, big-endian at bytes 16 and 20. */
export function pngSize(bytes: Buffer): { width: number; height: number } {
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

/** The colour of pixel (2, 2) of an image, read by drawing it on a canvas in the page. */
export function cornerPixel(page: Page, bytes: Buffer, mime: string): Promise<[number, number, number]> {
  return page.evaluate(
    async ({ b64, type }) => {
      const img = new Image()
      img.src = `data:${type};base64,${b64}`
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (ctx === null) throw new Error('no canvas context')
      ctx.drawImage(img, 0, 0)
      const [r, g, b] = ctx.getImageData(2, 2, 1, 1).data
      return [r ?? -1, g ?? -1, b ?? -1] as [number, number, number]
    },
    { b64: bytes.toString('base64'), type: mime },
  )
}

/** Counts pixels near the edge grey (107, 114, 128) and pure black pixels (a missing fill shows as black). */
export function paintCounts(page: Page, bytes: Buffer, mime: string): Promise<{ edge: number; black: number }> {
  return page.evaluate(
    async ({ b64, type }) => {
      const img = new Image()
      img.src = `data:${type};base64,${b64}`
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (ctx === null) throw new Error('no canvas context')
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, img.width, img.height).data
      let edge = 0
      let black = 0
      for (let i = 0; i < data.length; i += 4) {
        const [r = 0, g = 0, b = 0] = [data[i], data[i + 1], data[i + 2]]
        if (Math.abs(r - 107) < 6 && Math.abs(g - 114) < 6 && Math.abs(b - 128) < 6) edge++
        if (r < 10 && g < 10 && b < 10) black++
      }
      return { edge, black }
    },
    { b64: bytes.toString('base64'), type: mime },
  )
}
