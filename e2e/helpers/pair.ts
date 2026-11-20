import type { Browser, Page } from '@playwright/test'
import { uniqueEmail } from './admin'
import { addNodeAt, card, createProject, openProject, readyCanvas } from './editor'
import { createTeam, enableJoinCode, joinWithCode, openTeam, signUpVerifyAndSignIn } from './ui'

export const panel = (page: Page) => page.getByTestId('editor-panel')
export const titleField = (page: Page) => panel(page).getByLabel('Title', { exact: true })
export const colourButton = (page: Page, colour: string) => panel(page).getByRole('button', { name: `Colour ${colour}` })

// Selects a node and types a new title, leaving the field so the edit is made.
export async function rename(page: Page, id: string, title: string): Promise<void> {
  await card(page, id).click()
  await titleField(page).fill(title)
  await titleField(page).blur()
}


/** The owner (page `a`, own context) and a member (page `b`) with the project `Story` open and `count` nodes made by the owner. */
export async function ownerAndMember(browser: Browser, count: number) {
  const ctxA = await browser.newContext()
  const a = await ctxA.newPage()
  await a.goto('/')
  await signUpVerifyAndSignIn(a, uniqueEmail(), 'Owner')
  await createTeam(a, 'Crew')
  await openTeam(a, 'Crew')
  const code = await enableJoinCode(a)
  await createProject(a, 'Story')
  const ctxB = await browser.newContext()
  const b = await ctxB.newPage()
  await b.goto('/')
  await signUpVerifyAndSignIn(b, uniqueEmail(), 'Member')
  await joinWithCode(b, code, 'Crew')
  await openTeam(b, 'Crew')
  await openProject(b, 'Story')
  await openProject(a, 'Story')
  await readyCanvas(a, 0)
  const ids: string[] = []
  for (let i = 0; i < count; i++) ids.push(await addNodeAt(a, 40 + i * 260, 60))
  await readyCanvas(b, count)
  return { a, b, ctxA, ids }
}


/** Drags a card by (dx, dy) screen pixels with the mouse and releases it. */
export async function dragBy(page: Page, id: string, dx: number, dy: number): Promise<void> {
  const box = await card(page, id).boundingBox()
  if (box === null) throw new Error('card not on screen')
  await page.mouse.move(box.x + 40, box.y + 10)
  await page.mouse.down()
  await page.mouse.move(box.x + 40 + dx / 2, box.y + 10 + dy / 2, { steps: 10 })
  await page.mouse.move(box.x + 40 + dx, box.y + 10 + dy, { steps: 10 })
  await page.mouse.up()
}
