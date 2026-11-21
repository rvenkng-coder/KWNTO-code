// Protects: exporting the whole project (one page per chapter with nodes), trashed content staying out,
// an empty project being refused, and a very large map being scaled with a warning (export plan, Task 4).
import { expect, test, type Page } from '@playwright/test'
import { zipEntryText } from '../tests/helpers/zip-entry.ts'
import { adminPB } from './helpers/admin.ts'
import { addNodeAt, card, connectNodes, ownerWithProject, readyCanvas, waitForSave } from './helpers/editor.ts'
import { downloadBytes, exportDialog, exportMap, openExport, pngSize } from './helpers/export.ts'

async function addChapter(page: Page, title: string): Promise<void> {
  const created = waitForSave(page, 'chapters', 'POST')
  await page.getByRole('button', { name: 'Add chapter' }).click()
  await created
  await page.getByRole('tab', { name: title }).click()
}

/** Story with Chapter 1 (two connected nodes, ids returned), an empty Chapter 2 and Chapter 3 (one node). */
async function threeChapters(page: Page): Promise<string[]> {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const a = await addNodeAt(page, 40, 60)
  const b = await addNodeAt(page, 300, 60)
  await connectNodes(page, a, b)
  await addChapter(page, 'Chapter 2')
  await addChapter(page, 'Chapter 3')
  await readyCanvas(page, 0)
  await addNodeAt(page, 40, 60)
  await page.getByRole('tab', { name: 'Chapter 1' }).click()
  await readyCanvas(page, 2)
  return [a, b]
}

const pageCount = (text: string) => text.match(/\/Type \/Page\b(?!s)/g)?.length ?? 0

// Protects: a whole-project PDF has a page per chapter that has nodes, and none for an empty chapter.
test('a whole-project PDF has a page per chapter with nodes', async ({ page }) => {
  await threeChapters(page)
  const download = await exportMap(page, 'PDF', 'Whole project')
  expect(download.suggestedFilename()).toBe('Story.pdf')
  const text = (await downloadBytes(download)).toString('latin1')
  expect(pageCount(text)).toBe(2)
  expect(text).toContain('Story - Chapter 1')
  expect(text).toContain('Story - Chapter 3')
  expect(text).not.toContain('Story - Chapter 2')
})

// Protects: a whole-project Word file holds a heading and a map for each chapter with nodes.
test('a whole-project Word file has a heading and map per chapter with nodes', async ({ page }) => {
  await threeChapters(page)
  const download = await exportMap(page, 'Word', 'Whole project')
  expect(download.suggestedFilename()).toBe('Story.docx')
  const xml = zipEntryText(new Uint8Array(await downloadBytes(download)), 'word/document.xml')
  expect(xml).toContain('Story - Chapter 1')
  expect(xml).toContain('Story - Chapter 3')
  expect(xml).not.toContain('Story - Chapter 2')
  expect(xml.match(/<pic:pic/g)).toHaveLength(2)
})

// Protects: trashed chapters and trashed nodes never reach an export.
test('trashed chapters are not exported', async ({ page }) => {
  const [a] = await threeChapters(page)
  page.once('dialog', (d) => d.accept())
  const trashedChapter = waitForSave(page, 'chapters', 'PATCH')
  await page.getByRole('button', { name: 'Menu for Chapter 3' }).click()
  await page.getByRole('menuitem', { name: 'Move to trash' }).click()
  await trashedChapter
  await page.getByRole('tab', { name: 'Chapter 1' }).click()
  await readyCanvas(page, 2)
  const trashedNode = waitForSave(page, 'nodes', 'PATCH')
  await card(page, a).click()
  await page.getByRole('button', { name: 'Move to trash' }).click()
  await trashedNode
  await readyCanvas(page, 1)
  const text = (await downloadBytes(await exportMap(page, 'PDF', 'Whole project'))).toString('latin1')
  expect(pageCount(text)).toBe(1)
  expect(text).toContain('Story - Chapter 1')
  expect(text).not.toContain('Story - Chapter 3')
})

// Protects: a project with nothing to draw is refused with a message and downloads nothing.
test('a project with no nodes is refused', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await addChapter(page, 'Chapter 2')
  await openExport(page, 'PDF', 'Whole project')
  const noDownload = expect(page.waitForEvent('download', { timeout: 2000 })).rejects.toThrow()
  await exportDialog(page).getByRole('button', { name: 'Export', exact: true }).click()
  await expect(exportDialog(page).getByRole('alert')).toHaveText('This project has no nodes to export.')
  await noDownload
})

// Protects: a huge map is scaled to fit one image (a bigger canvas comes out blank) and the dialog says labels may be small.
test('a large map is scaled to fit and the dialog warns', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  await addNodeAt(page, 40, 60)
  const far = await addNodeAt(page, 300, 60)
  const pb = await adminPB()
  // The content guard wants the version the record has now (backend.md "Guarded writes").
  const { version } = await pb.collection('nodes').getOne(far)
  await pb.collection('nodes').update(far, { x: 40000, version })
  await page.reload()
  await readyCanvas(page, 2)
  const download = await exportMap(page, 'PNG', 'Current chapter')
  const { width } = pngSize(await downloadBytes(download))
  expect(width).toBeGreaterThan(0)
  expect(width).toBeLessThanOrEqual(8192)
  const dialog = exportDialog(page)
  await expect(dialog.getByText('Some maps were large, so their labels may be small in the export.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
})
