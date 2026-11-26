import { expect, test } from '@playwright/test'
import { adminPB } from './helpers/admin'
import { card, ownerWithProject } from './helpers/editor'
import { makeLink, projectIdOf, seedStory } from './helpers/share'

// Protects design 5 (view links): share views show what a person put on a node: a signed-out viewer sees the card at
// its saved size with its cover image, and the node's links in the panel, opening in a new tab.
test("a view link shows a node's size, cover and links", async ({ page, browser }) => {
  await ownerWithProject(page, 'Story')
  const projectId = projectIdOf(page)
  const { gate, door } = await seedStory(projectId)
  const pb = await adminPB()
  const opts = { requestKey: null }
  const image = await pb.collection('media').getFirstListItem(pb.filter('node = {:n}', { n: gate }), opts)
  const current = await pb.collection('nodes').getOne(gate, opts)
  await pb
    .collection('nodes')
    .update(gate, { width: 320, height: 300, cover_media: image.id, version: current.version }, opts)
  const owner = await pb.collection('projects').getOne(projectId, { ...opts, expand: 'team.team_members_via_team' })
  const creator = owner.expand?.team?.expand?.team_members_via_team?.[0]?.user as string
  await pb
    .collection('node_links')
    .create({ project: projectId, node: gate, creator, title: 'Trailer', url: 'https://example.com/v' }, opts)
  const address = await makeLink(page, 'view', 'live')

  const guest = await (await browser.newContext()).newPage()
  await guest.goto(address)
  const sized = card(guest, gate)
  await expect(sized.getByRole('img', { name: 'pic' })).toBeVisible()
  // offsetWidth and offsetHeight ignore the canvas zoom.
  expect(await sized.evaluate((el: HTMLElement) => [el.offsetWidth, el.offsetHeight])).toEqual([320, 300])
  expect(await card(guest, door).evaluate((el: HTMLElement) => el.offsetWidth)).toBe(224)

  await sized.click({ position: { x: 20, y: 8 } })
  const link = guest.getByTestId('readonly-panel').getByRole('link', { name: 'Trailer' })
  await expect(link).toHaveAttribute('href', 'https://example.com/v')
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
})
