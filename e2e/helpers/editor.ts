import { expect, type Page, type Response } from '@playwright/test'
import { uniqueEmail } from './admin'
import { SETUP_TIMEOUT_MS, createTeam, openTeam, signUpVerifyAndSignIn } from './ui'

/** Waits for the server to answer a save of a collection (POST, PATCH or DELETE), so a reload cannot cut it off. */
export function waitForSave(page: Page, collection: string, method: 'POST' | 'PATCH' | 'DELETE'): Promise<Response> {
  return page.waitForResponse(
    (r) => r.request().method() === method && r.url().includes(`/api/collections/${collection}/records`) && r.ok(),
  )
}

/** On the team screen: makes a project and waits for it to appear in the list. */
export async function createProject(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByLabel('Project name').fill(name)
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByTestId('project-list')).toContainText(name)
}

/** On the team screen: opens a project and waits for its first tab. */
export async function openProject(page: Page, name: string): Promise<void> {
  await page.getByTestId('project-list').getByRole('button', { name, exact: true }).click()
  await expect(page.getByTestId('editor-canvas')).toBeVisible({ timeout: SETUP_TIMEOUT_MS })
  await expect(page.getByRole('tab', { name: 'Chapter 1' })).toBeVisible({ timeout: SETUP_TIMEOUT_MS })
}

/** The titles of the chapter tabs, left to right. */
export function tabTitles(page: Page): Promise<string[]> {
  return page.getByRole('tab').allTextContents()
}

/**
 * Signs up, verifies and signs in a new account, makes a team and a project and opens the
 * project. Waits for the `Chapter 1` tab.
 */
export async function ownerWithProject(page: Page, projectName: string): Promise<{ email: string }> {
  const email = uniqueEmail()
  await page.goto('/')
  await signUpVerifyAndSignIn(page, email, 'Owner')
  await createTeam(page, 'Crew')
  await openTeam(page, 'Crew')
  await createProject(page, projectName)
  await openProject(page, projectName)
  return { email }
}

/** The node cards on the canvas. */
export const cards = (page: Page) => page.getByTestId('node-card')

/** Double-clicks the empty canvas at a point (relative to the canvas) and waits for the new node to be saved. */
export async function addNodeAt(page: Page, x: number, y: number): Promise<string> {
  const before = await cards(page).count()
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('/api/collections/nodes/records') && r.ok(),
  )
  await page.getByTestId('canvas').dblclick({ position: { x, y } })
  const response = await saved
  await expect(cards(page)).toHaveCount(before + 1)
  return ((await response.json()) as { id: string }).id
}

/** Drags from one node's "+" (new choice) handle to another node's incoming handle, waits for the save and returns the new choice's connection id. */
export async function connectNodes(page: Page, fromId: string, toId: string): Promise<string> {
  const saved = waitForSave(page, 'connections', 'POST')
  await page.locator(`[data-node-id="${fromId}"] [data-testid="new-choice-handle"]`)
    .dragTo(page.locator(`[data-node-id="${toId}"] .react-flow__handle.target`))
  return ((await (await saved).json()) as { id: string }).id
}

/** One node card by id. */
export const card = (page: Page, id: string) => page.locator(`[data-testid="node-card"][data-node-id="${id}"]`)

/** Waits until the canvas has drawn the store's nodes and shows `count` of them. */
export async function readyCanvas(page: Page, count: number): Promise<void> {
  await expect(page.getByTestId('canvas')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('canvas')).toHaveAttribute('data-node-count', String(count))
}

/** A node's position in canvas coordinates, read from React Flow's transform. */
export async function nodePosition(page: Page, id: string): Promise<{ x: number; y: number }> {
  const transform = await page.locator(`.react-flow__node[data-id="${id}"]`).evaluate((el) => (el as HTMLElement).style.transform)
  const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(transform)
  if (match === null) throw new Error(`no position in "${transform}"`)
  return { x: Number(match[1]), y: Number(match[2]) }
}
