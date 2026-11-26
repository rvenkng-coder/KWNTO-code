import { expect, test } from '@playwright/test'
import { adminPB } from './helpers/admin'
import { card, ownerWithProject } from './helpers/editor'
import { makeLink, projectIdOf, seedStory } from './helpers/share'

const TITLE = '<img src=x onerror="window.__xss=1">'
const TEXT = '<script>window.__xss=1</script><b>bold</b>'

// Protects security.md 5 (XSS) and Review Focus 5 for the read-only viewer: a node title, a script line,
// a character name and a choice label with HTML show as typed text on a share link's page; no script
// runs and no element is made from them.
test('titles, lines and choices with HTML show as text in the read-only viewer', async ({ page, browser }) => {
  await ownerWithProject(page, 'Story')
  const projectId = projectIdOf(page)
  const { gate } = await seedStory(projectId)
  const pb = await adminPB()
  const opts = { requestKey: null }
  // The content collections refuse an update without the record's current version.
  const change = async (collection: string, id: string, fields: Record<string, string>) => {
    const current = await pb.collection(collection).getOne(id, opts)
    await pb.collection(collection).update(id, { ...fields, version: current.version }, opts)
  }
  await change('nodes', gate, { title: TITLE })
  const line = await pb.collection('script_lines').getFirstListItem(pb.filter('node = {:n}', { n: gate }), opts)
  await change('script_lines', line.id, { character: TITLE, text: TEXT })
  const choice = await pb.collection('connections').getFirstListItem(pb.filter('from_node = {:n}', { n: gate }), opts)
  await change('connections', choice.id, { label: TEXT })
  const address = await makeLink(page, 'view', 'live')

  const guest = await (await browser.newContext()).newPage()
  await guest.goto(address)
  await expect(guest.getByTestId('choice-row')).toContainText(TEXT)
  await card(guest, gate).click()
  const panel = guest.getByTestId('readonly-panel')
  await expect(panel).toContainText(TITLE)
  await expect(panel).toContainText(TEXT)
  await expect(
    guest.locator(
      '[data-testid="readonly-panel"] b, [data-testid="readonly-panel"] script, [data-testid="readonly-panel"] img[src="x"]',
    ),
  ).toHaveCount(0)
  await expect(guest.locator('img[src="x"]')).toHaveCount(0)
  expect(await guest.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})
