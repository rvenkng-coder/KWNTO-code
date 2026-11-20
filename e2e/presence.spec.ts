// Protects design 5, 8b and 9c and plan 2026-11-20-sharing D14: when a teammate is editing a
// node, the card and the very field show "<name> is editing" for everyone else (never for the
// person themselves), it moves with their focus, and it clears when they leave the field or
// close the tab.
import { expect, test } from '@playwright/test'
import { card } from './helpers/editor'
import { ownerAndMember, panel, titleField } from './helpers/pair'

const SOON = { timeout: 12_000 }

// Protects D14 and design 8b: two browsers on one node. The member focuses the title (the
// owner sees it on the card and beside the title), then a script line (the badge moves beside
// that line), then leaves (it clears). The member never sees their own name.
test('a teammate editing a node shows on the card and the field', async ({ browser }) => {
  const { a, b, ids } = await ownerAndMember(browser, 1)
  const [id] = ids as [string]
  await card(a, id).click()
  await card(b, id).click()
  await expect(titleField(b)).toBeVisible()
  await expect(titleField(a)).toBeVisible()

  await titleField(b).focus()
  await expect(card(a, id).getByTestId('editing-badge')).toHaveText('Member is editing', SOON)
  await expect(panel(a).getByTestId('editing-badge')).toHaveText('Member is editing', SOON)

  await panel(b).getByRole('button', { name: 'Add line' }).click()
  await expect(panel(a).getByTestId('line-row')).toHaveCount(1)
  await panel(b).getByTestId('line-row').getByLabel('Line text').focus()
  const lineBadge = panel(a).getByTestId('line-row').getByTestId('editing-badge')
  await expect(lineBadge).toHaveText('Member is editing', SOON)
  await expect(panel(a).getByTestId('editing-badge')).toHaveCount(1, SOON)

  await expect(b.getByTestId('editing-badge')).toHaveCount(0)
  await b.evaluate(() => (document.activeElement as HTMLElement).blur())
  await expect(panel(a).getByTestId('editing-badge')).toHaveCount(0, SOON)
  await expect(card(a, id).getByTestId('editing-badge')).toHaveCount(0, SOON)
})

// Protects D14: a person who closes the tab is no longer shown as editing: the page's own
// clean-up, or at the latest the timeout.
test('closing the tab clears the indicator', async ({ browser }) => {
  const { a, b, ids } = await ownerAndMember(browser, 1)
  const [id] = ids as [string]
  await card(b, id).click()
  await titleField(b).focus()
  await expect(card(a, id).getByTestId('editing-badge')).toHaveText('Member is editing', SOON)
  await b.close()
  await expect(card(a, id).getByTestId('editing-badge')).toHaveCount(0, { timeout: 35_000 })
})
