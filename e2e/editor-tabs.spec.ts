// Protects: the draw.io-style chapter tab bar (editor tabs plan, Task 1): its menus show above the
// canvas and close like menus, a chapter is renamed from its menu, the All chapters list reopens a
// closed tab, trashing the open chapter shows its neighbour, and chapter actions live in the bar.
import { expect, test, type Page } from '@playwright/test'
import { cards, ownerWithProject, tabTitles, waitForSave } from './helpers/editor'

async function addChapter(page: Page): Promise<void> {
  const created = waitForSave(page, 'chapters', 'POST')
  await page.getByRole('button', { name: 'Add chapter' }).click()
  await created
}

// Protects: the tab menu is drawn on top of the canvas, so every item is seen and gets the click (Review Focus 2).
test('the tab menu shows above the canvas and every item can be clicked', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await addChapter(page)
  await page.getByRole('button', { name: 'Menu for Chapter 2' }).click()
  const menu = page.getByRole('menu', { name: 'Chapter menu' })
  const items = menu.getByRole('menuitem')
  await expect(items).toHaveText(['Rename', 'Move left', 'Move right', 'Move to trash'])
  for (const item of await items.all()) {
    await expect(item).toBeInViewport({ ratio: 1 })
    const box = (await item.boundingBox())!
    const topmost = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('[role="menuitem"]')?.textContent ?? null,
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    )
    expect(topmost).toBe(await item.textContent())
  }
})

// Protects: a menu closes on Escape and on a click outside it, and that click does not add a node (decision E1).
test('a menu closes with Escape and with a click outside', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  const menuButton = page.getByRole('button', { name: 'Menu for Chapter 1' })
  await menuButton.click()
  await expect(page.getByRole('menu')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  const nodes = await cards(page).count()
  await menuButton.click()
  await expect(page.getByRole('menu')).toHaveCount(1)
  await page.getByTestId('canvas').click({ position: { x: 20, y: 20 } })
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(cards(page)).toHaveCount(nodes)
})

// Protects: Rename in the tab menu opens the title box, and the new title is saved (decision E2).
test('rename from the tab menu', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await page.getByRole('button', { name: 'Menu for Chapter 1' }).click()
  await page.getByRole('menuitem', { name: 'Rename' }).click()
  const renamed = waitForSave(page, 'chapters', 'PATCH')
  await page.getByRole('textbox', { name: 'Chapter title' }).fill('Prologue')
  await page.getByRole('textbox', { name: 'Chapter title' }).press('Enter')
  await renamed
  await expect(page.getByRole('tab', { name: 'Prologue' })).toBeVisible()
  expect(await tabTitles(page)).toEqual(['Prologue'])
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Prologue' })).toBeVisible()
  expect(await tabTitles(page)).toEqual(['Prologue'])
})

// Protects: "≡" lists every chapter, marks the open one, and reopens a closed tab (decision E3).
test('the All chapters list opens a closed tab', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await addChapter(page)
  await page.getByRole('button', { name: 'Close Chapter 2' }).click()
  await expect(page.getByRole('tab', { name: 'Chapter 2' })).toHaveCount(0)
  await page.getByRole('button', { name: 'All chapters' }).click()
  const list = page.getByRole('menu', { name: 'All chapters' })
  await expect(list.getByRole('menuitem')).toHaveText(['Chapter 1', 'Chapter 2', 'Trash'])
  await expect(list.getByRole('menuitem', { name: 'Chapter 1' })).toHaveAttribute('aria-current', 'true')
  await list.getByRole('menuitem', { name: 'Chapter 2' }).click()
  await expect(page.getByRole('tab', { name: 'Chapter 2' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Chapter 2' })).toHaveAttribute('aria-selected', 'true')
})

// Protects: trashing the chapter that is open moves to its neighbour, not to an empty canvas (Review Focus 3).
test('trashing the open chapter shows its neighbour', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await addChapter(page)
  await expect(page.getByRole('tab', { name: 'Chapter 2' })).toHaveAttribute('aria-selected', 'true')
  page.once('dialog', (d) => d.accept())
  const trashed = waitForSave(page, 'chapters', 'PATCH')
  await page.getByRole('button', { name: 'Menu for Chapter 2' }).click()
  await page.getByRole('menuitem', { name: 'Move to trash' }).click()
  await trashed
  await expect.poll(() => tabTitles(page)).toEqual(['Chapter 1'])
  await expect(page.getByRole('tab', { name: 'Chapter 1' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('canvas')).toBeVisible()
})

// Protects: the left chapter list is gone; adding and listing chapters happen in the tab bar (design goal 4).
test('chapter actions live in the tab bar, not the left panel', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await expect(page.getByTestId('chapter-list')).toHaveCount(0)
  await expect(page.getByTestId('editor-canvas').getByRole('button', { name: 'Add chapter' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'All chapters' })).toBeVisible()
})

// Protects: the menu of a tab scrolled partly out of the strip opens and stays open; the scroll
// that brought its button into view is not the person scrolling away (decision E1, Task 1 Flow).
test('the menu of a scrolled-off tab stays open and works', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 })
  await ownerWithProject(page, 'Story')
  for (let i = 0; i < 4; i++) await addChapter(page)
  await page.getByRole('tablist').evaluate((strip) => { strip.scrollLeft = 0 })
  const moved = waitForSave(page, 'chapters', 'PATCH')
  await page.getByRole('button', { name: 'Menu for Chapter 5' }).click()
  await page.getByRole('menuitem', { name: 'Move left' }).click()
  await moved
  await expect.poll(() => tabTitles(page)).toEqual(['Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 5', 'Chapter 4'])
})

// Protects: scrolling the tab strip while a menu is open closes it, so it never floats away from its tab (decision E1).
test('scrolling the tab strip closes an open menu', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 })
  await ownerWithProject(page, 'Story')
  for (let i = 0; i < 4; i++) await addChapter(page)
  await page.getByRole('button', { name: 'Menu for Chapter 1' }).click()
  await expect(page.getByRole('menu', { name: 'Chapter menu' })).toBeVisible()
  await page.getByRole('tablist').evaluate((strip) => { strip.scrollLeft = strip.scrollWidth })
  await expect(page.getByRole('menu')).toHaveCount(0)
})

// Protects: a long All chapters list stays inside the window and scrolls, so the last chapter can still be reopened (spec anti-goal: no chapter action unreachable).
test('a long All chapters list scrolls inside the window', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 420 })
  await ownerWithProject(page, 'Story')
  for (let i = 0; i < 11; i++) await addChapter(page)
  await page.getByRole('button', { name: 'All chapters' }).click()
  const list = page.getByRole('menu', { name: 'All chapters' })
  const box = (await list.boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(420)
  const last = list.getByRole('menuitem', { name: 'Chapter 12' })
  await last.scrollIntoViewIfNeeded()
  await expect(list).toBeVisible()
  await last.click()
  await expect(page.getByRole('tab', { name: 'Chapter 12' })).toHaveAttribute('aria-selected', 'true')
})
