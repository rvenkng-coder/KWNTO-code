import { expect, type Page } from '@playwright/test'
import { uniqueEmail } from './admin'
import { createTeam, openTeam, signUpVerifyAndSignIn } from './ui'

/** Waits for the server to answer a save of a collection (POST or PATCH), so a reload cannot cut it off. */
export function waitForSave(page: Page, collection: string, method: 'POST' | 'PATCH'): Promise<unknown> {
  return page.waitForResponse(
    (r) => r.request().method() === method && r.url().includes(`/api/collections/${collection}/records`) && r.ok(),
  )
}

/** On the team screen: makes a project and waits for it to appear in the list. */
export async function createProject(page: Page, name: string): Promise<void> {
  await page.getByLabel('Project name').fill(name)
  await page.getByRole('button', { name: 'New project' }).click()
  await expect(page.getByTestId('project-list')).toContainText(name)
}

/** On the team screen: opens a project and waits for its first tab. */
export async function openProject(page: Page, name: string): Promise<void> {
  await page.getByTestId('project-list').getByRole('button', { name, exact: true }).click()
  await expect(page.getByTestId('editor-canvas')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Chapter 1' })).toBeVisible()
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
