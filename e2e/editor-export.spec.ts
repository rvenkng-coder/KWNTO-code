import { expect, test, type Page } from '@playwright/test'
import {
  addNodeAt,
  cards,
  connectNodes,
  nodePosition,
  ownerWithProject,
  readyCanvas,
  waitForSave,
} from './helpers/editor.ts'
import {
  cornerPixel,
  downloadBytes,
  exportButton,
  exportDialog,
  exportMap,
  openExport,
  paintCounts,
  pngSize,
} from './helpers/export.ts'

async function storyWithTwoNodes(page: Page): Promise<[string, string]> {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const a = await addNodeAt(page, 40, 60)
  const b = await addNodeAt(page, 300, 60)
  await connectNodes(page, a, b)
  await readyCanvas(page, 2)
  return [a, b]
}

// Protects: the tool opens a labelled dialog with the right defaults, and Escape hands focus back to the tool.
test('the Export map dialog opens from the tool strip and closes on Escape', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  await exportButton(page).click()
  const dialog = exportDialog(page)
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('group', { name: 'Format' }).getByRole('radio')).toHaveCount(4)
  await expect(dialog.getByRole('radio', { name: 'PDF', exact: true })).toBeChecked()
  await expect(dialog.getByRole('group', { name: 'What to export' }).getByRole('radio')).toHaveCount(2)
  await expect(dialog.getByRole('radio', { name: 'Current chapter' })).toBeChecked()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(exportButton(page)).toBeFocused()
})

// Protects: a PNG of the chapter downloads under the clean name and is a real image of the map.
test('a PNG of the current chapter downloads with its name', async ({ page }) => {
  await storyWithTwoNodes(page)
  const download = await exportMap(page, 'PNG', 'Current chapter')
  expect(download.suggestedFilename()).toBe('Story - Chapter 1.png')
  const bytes = await downloadBytes(download)
  expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
  const { width, height } = pngSize(bytes)
  expect(width).toBeGreaterThan(200)
  expect(height).toBeGreaterThan(200)
})

// Protects: JPG is a real JPEG under its own extension.
test('a JPG of the current chapter downloads', async ({ page }) => {
  await storyWithTwoNodes(page)
  const download = await exportMap(page, 'JPG', 'Current chapter')
  expect(download.suggestedFilename()).toBe('Story - Chapter 1.jpg')
  expect([...(await downloadBytes(download)).subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff])
})

// Protects: images cannot ask for the whole project, and the choice comes back for PDF.
test('images export the current chapter only', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  await openExport(page, 'PDF', 'Whole project')
  const dialog = exportDialog(page)
  await dialog.getByRole('radio', { name: 'JPG', exact: true }).check()
  await expect(dialog.getByRole('radio', { name: 'Whole project' })).toBeDisabled()
  await expect(dialog.getByRole('radio', { name: 'Current chapter' })).toBeChecked()
  await expect(dialog.getByText('Images export the current chapter only.')).toBeVisible()
  await dialog.getByRole('radio', { name: 'PNG', exact: true }).check()
  await expect(dialog.getByRole('radio', { name: 'Whole project' })).toBeDisabled()
  await dialog.getByRole('radio', { name: 'PDF', exact: true }).check()
  await expect(dialog.getByRole('radio', { name: 'Whole project' })).toBeEnabled()
  await expect(dialog.getByText('Images export the current chapter only.')).toBeHidden()
})

// Protects: PDF and Word files download with the right names and content.
test('PDF and Word files of the current chapter download', async ({ page }) => {
  await storyWithTwoNodes(page)
  const pdf = await exportMap(page, 'PDF', 'Current chapter')
  expect(pdf.suggestedFilename()).toBe('Story - Chapter 1.pdf')
  const text = (await downloadBytes(pdf)).toString('latin1')
  expect(text.startsWith('%PDF-')).toBe(true)
  expect(text.match(/\/Type \/Page\b(?!s)/g)).toHaveLength(1)
  expect(text).toContain('Story - Chapter 1')
  const docx = await exportMap(page, 'Word', 'Current chapter')
  expect(docx.suggestedFilename()).toBe('Story - Chapter 1.docx')
  expect((await downloadBytes(docx)).subarray(0, 2).toString('latin1')).toBe('PK')
})

// Protects: a dark-theme account never gets a dark, unprintable export.
test('a dark account still gets a light map on white', async ({ page }) => {
  await storyWithTwoNodes(page)
  // A new account starts dark (see the theme test in shell.spec.ts), so the page is dark here.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const download = await exportMap(page, 'PNG', 'Current chapter')
  expect(await cornerPixel(page, await downloadBytes(download), 'image/png')).toEqual([255, 255, 255])
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

// Protects: an empty chapter is refused with a message and nothing is downloaded.
test('an empty chapter is refused and nothing downloads', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  await openExport(page, 'PNG', 'Current chapter')
  const noDownload = expect(page.waitForEvent('download', { timeout: 2000 })).rejects.toThrow()
  await exportDialog(page).getByRole('button', { name: 'Export', exact: true }).click()
  await expect(exportDialog(page).getByRole('alert')).toHaveText('This chapter has no nodes to export.')
  await noDownload
})

// Protects: export only reads: no write to the server, no move, no lost selection, no leftover stage.
test('exporting changes nothing in the editor', async ({ page }) => {
  const [a] = await storyWithTwoNodes(page)
  await page.locator(`[data-testid="node-card"][data-node-id="${a}"]`).click()
  await expect(page.locator(`.react-flow__node.selected[data-id="${a}"]`)).toHaveCount(1)
  const before = await nodePosition(page, a)
  const writes: string[] = []
  page.on('request', (r) => {
    if (r.method() !== 'GET' && r.url().includes('/api/')) writes.push(`${r.method()} ${r.url()}`)
  })
  await exportMap(page, 'PNG', 'Current chapter')
  await expect(page.getByTestId('export-stage')).toHaveCount(0)
  await expect(exportDialog(page)).toBeHidden()
  expect(await nodePosition(page, a)).toEqual(before)
  await expect(page.locator(`.react-flow__node.selected[data-id="${a}"]`)).toHaveCount(1)
  expect(writes).toEqual([])
  await expect(cards(page)).toHaveCount(2)
})

// Protects: the connection line is drawn in the export and its label box is white, not black (SVG styles from CSS classes are lost in the capture).
test('a connection and its label are drawn in the export', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const a = await addNodeAt(page, 40, 60)
  const b = await addNodeAt(page, 300, 60)
  const choiceId = await connectNodes(page, a, b)
  await page.getByTestId(`rf__edge-${choiceId}`).click()
  const named = waitForSave(page, 'connections', 'PATCH')
  const field = page.getByTestId('editor-panel').getByLabel('Choice text')
  await field.fill('Choice one')
  await field.blur()
  await named
  const bytes = await downloadBytes(await exportMap(page, 'PNG', 'Current chapter'))
  const { edge, black } = await paintCounts(page, bytes, 'image/png')
  expect(edge).toBeGreaterThan(300)
  expect(black).toBe(0)
})

// Protects: the dialog is modal for the keyboard too: Tab stays inside it and the editor's shortcuts do nothing behind it.
test('the dialog keeps the keyboard inside and shields the editor shortcuts', async ({ page }) => {
  const [a] = await storyWithTwoNodes(page)
  await page.locator(`[data-testid="node-card"][data-node-id="${a}"]`).click()
  const writes: string[] = []
  page.on('request', (r) => {
    if (r.method() !== 'GET' && r.url().includes('/api/')) writes.push(r.method())
  })
  await exportButton(page).click()
  const dialog = exportDialog(page)
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press(i % 2 === 0 ? 'Tab' : 'Shift+Tab')
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  }
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab')
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Delete')
  await page.keyboard.press('Control+x')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(cards(page)).toHaveCount(2)
  expect(writes).toEqual([])
})

// Protects: a PDF whose chapter name the built-in font cannot draw still shows it (drawn as a picture); a Latin name stays text.
test('a PDF heading in another script is drawn as a picture', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  await addNodeAt(page, 40, 60)
  const images = (text: string) => text.match(/\/Subtype \/Image/g)?.length ?? 0
  const latin = (await downloadBytes(await exportMap(page, 'PDF', 'Current chapter'))).toString('latin1')
  expect(latin).toContain('(Story - Chapter 1)')
  await page.getByRole('tab', { name: 'Chapter 1' }).dblclick()
  const renamed = waitForSave(page, 'chapters', 'PATCH')
  await page.getByRole('textbox', { name: 'Chapter title' }).fill('第一章')
  await page.getByRole('textbox', { name: 'Chapter title' }).press('Enter')
  await renamed
  const other = (await downloadBytes(await exportMap(page, 'PDF', 'Current chapter'))).toString('latin1')
  expect(other).not.toContain('(Story - ')
  expect(images(other)).toBeGreaterThan(images(latin))
})

// Protects: an export whose picture never arrives ends with a message after 30 s and the dialog can be used again, not "Exporting…" for ever.
test('an export that never finishes fails with a message', async ({ page }) => {
  await storyWithTwoNodes(page)
  await page.route(/html-to-image/, () => undefined)
  await page.clock.install()
  await openExport(page, 'PNG', 'Current chapter')
  await exportDialog(page).getByRole('button', { name: 'Export', exact: true }).click()
  await expect(exportDialog(page).getByRole('status')).toHaveText('Exporting…')
  await page.clock.fastForward(31_000)
  await expect(exportDialog(page).getByRole('alert')).toHaveText(
    'The export failed. Try again, or export one chapter at a time.',
  )
  await expect(exportDialog(page).getByRole('button', { name: 'Export', exact: true })).toBeEnabled()
})
