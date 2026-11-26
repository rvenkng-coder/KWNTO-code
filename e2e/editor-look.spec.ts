// Protects: the cleaner look (editor cards plan, Task 5; design goal 4), in both themes: node cards are
// soft (a large radius and a shadow), panel section labels are small uppercase labels, and the page
// still never scrolls.
import { expect, test, type Page } from '@playwright/test'
import { addNodeAt, card, ownerWithProject, readyCanvas, waitForSave } from './helpers/editor'

const panel = (page: Page) => page.getByTestId('editor-panel')

/** One node, selected, with one choice and one cue. */
async function nodeWithChoiceAndCue(page: Page): Promise<string> {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const a = await addNodeAt(page, 40, 60)
  await card(page, a).click()
  const choice = waitForSave(page, 'connections', 'POST')
  await panel(page).getByRole('button', { name: 'Add choice' }).click()
  await choice
  const cue = waitForSave(page, 'cues', 'POST')
  await panel(page).getByRole('button', { name: 'Add cue' }).click()
  await cue
  await expect(card(page, a).getByTestId('choice-row')).toHaveCount(1)
  return a
}

// Protects: design goal 4: the soft look holds in light and in dark (a flat dark theme still keeps the card's shadow).
test('cards and panels use the soft look in both themes', async ({ page }) => {
  const a = await nodeWithChoiceAndCue(page)
  const html = page.locator('html')
  const check = async () => {
    const style = await card(page, a).evaluate((el) => {
      const s = getComputedStyle(el)
      return { radius: parseFloat(s.borderTopLeftRadius), shadow: s.boxShadow }
    })
    expect(style.radius).toBeGreaterThanOrEqual(12)
    expect(style.shadow).not.toBe('none')
    const label = await panel(page)
      .getByRole('heading', { name: 'Choices' })
      .evaluate((el) => getComputedStyle(el).textTransform)
    expect(label).toBe('uppercase')
    const sizes = await page.evaluate(() => ({ doc: document.documentElement.scrollHeight, win: window.innerHeight }))
    expect(sizes.doc).toBe(sizes.win)
  }
  // The theme the browser starts in, then the other one.
  const first = (await html.getAttribute('data-theme')) === 'dark' ? 'dark' : 'light'
  const second = first === 'dark' ? 'light' : 'dark'
  await check()
  await page.getByRole('switch', { name: 'Dark theme' }).click()
  await expect(html).toHaveAttribute('data-theme', second)
  await check()
})
