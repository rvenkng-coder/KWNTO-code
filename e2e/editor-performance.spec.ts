// Protects: the canvas performance budget (editor core plan, Task 10; roadmap "named risk"):
// a chapter of 500 nodes in a project of 5,000 lines opens within 3 s, and a drag saves once.
import { expect, test, type Page } from '@playwright/test'
import { uniqueEmail } from './helpers/admin'
import { cards, waitForSave } from './helpers/editor'
import { seedLargeProject } from './helpers/seed'
import { createTeam, openTeam, signUpVerifyAndSignIn } from './helpers/ui'

const BUDGET_MS = 3_000

type Box = { x: number; y: number; width: number; height: number }

// A card wholly inside the canvas, so the drag starts on the card and not on whatever covers its clipped part.
async function cardInView(page: Page): Promise<Box> {
  const canvas = await page.getByTestId('canvas').boundingBox()
  if (canvas === null) throw new Error('no canvas on screen')
  for (const card of await cards(page).all()) {
    const b = await card.boundingBox()
    const inside = b !== null && b.x > canvas.x + 20 && b.y > canvas.y + 20 &&
      b.x + b.width + 150 < canvas.x + canvas.width && b.y + b.height + 80 < canvas.y + canvas.height
    if (inside) return b
  }
  throw new Error('no card wholly inside the canvas')
}

// Protects: plan Global Constraints (canvas budget) and engineering 9 (positions saved on drag end only).
test('a 500-node chapter opens within budget', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('/')
  await signUpVerifyAndSignIn(page, uniqueEmail(), 'Owner')
  await createTeam(page, 'Crew')
  await openTeam(page, 'Crew')
  const teamId = /#\/team\/([a-z0-9]+)/.exec(page.url())?.[1]
  if (teamId === undefined) throw new Error(`no team id in ${page.url()}`)
  const { projectId, chapterId } = await seedLargeProject(teamId, 500, 10)

  // A full page load (not a hash change), so the time covers loading the app and the project.
  await page.goto('about:blank')
  const started = Date.now()
  await page.goto(`/#/project/${projectId}/chapter/${chapterId}`)
  const canvas = page.getByTestId('canvas')
  await expect(canvas).toHaveAttribute('data-node-count', '500', { timeout: 30_000 })
  await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 30_000 })
  await expect(cards(page).first()).toBeVisible()
  const loadMs = Date.now() - started
  test.info().annotations.push({ type: 'load-ms', description: String(loadMs) })
  console.log(`[perf] ${test.info().project.name}: ready in ${loadMs} ms`)

  const patches: string[] = []
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/api/collections/nodes/records/')) patches.push(r.url())
  })
  const box = await cardInView(page)
  const saved = waitForSave(page, 'nodes', 'PATCH')
  await page.mouse.move(box.x + 30, box.y + 8)
  await page.mouse.down()
  await page.mouse.move(box.x + 130, box.y + 60, { steps: 15 })
  await page.mouse.up()
  await saved
  expect(patches).toHaveLength(1)
  expect(loadMs).toBeLessThan(BUDGET_MS)
})
