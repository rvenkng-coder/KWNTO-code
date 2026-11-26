import { expect, type Page } from '@playwright/test'
import { adminPB } from './admin'
import { PNG_1PX } from './media'

type Permission = 'view' | 'comment' | 'edit'
type Kind = 'live' | 'snapshot'

export const shareDialog = (page: Page) => page.getByRole('dialog')

/** The id of the project open in the editor, from the address. */
export function projectIdOf(page: Page): string {
  const id = /#\/project\/([a-z0-9]{15})/.exec(page.url())?.[1]
  if (id === undefined) throw new Error(`no project in ${page.url()}`)
  return id
}

/** Opens the Share dialog from the editor's title bar. */
export async function openShareDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Share' }).click()
  await expect(shareDialog(page)).toBeVisible()
}

/** Makes a link in the dialog (opening it first if needed), leaves it open and returns the address shown in the new row. */
export async function makeLink(page: Page, permission: Permission, kind: Kind): Promise<string> {
  if (!(await shareDialog(page).isVisible())) await openShareDialog(page)
  const label = { view: 'Can view', comment: 'Can comment', edit: 'Can edit' }[permission]
  await shareDialog(page).getByLabel('Who can open it').selectOption({ label })
  await shareDialog(page)
    .getByLabel('Kind')
    .selectOption({ label: kind === 'live' ? 'Live' : 'Snapshot' })
  const before = await shareDialog(page).getByTestId('link-row').count()
  await shareDialog(page).getByRole('button', { name: 'Create link' }).click()
  await expect(shareDialog(page).getByTestId('link-row')).toHaveCount(before + 1)
  return shareDialog(page).getByTestId('link-row').first().getByLabel('Link address').inputValue()
}

/** Gives the project two nodes in its first chapter ("Gate" with a line, an image and a choice to "Door"), as the admin. */
export async function seedStory(projectId: string): Promise<{ gate: string; door: string }> {
  const pb = await adminPB()
  const opts = { requestKey: null }
  const chapter = await pb.collection('chapters').getFirstListItem(pb.filter('project = {:p}', { p: projectId }), opts)
  const node = (title: string, x: number) =>
    pb.collection('nodes').create({ project: projectId, chapter: chapter.id, title, color: 'blue', x, y: 40 }, opts)
  const gate = await node('Gate', 40)
  const door = await node('Door', 420)
  await pb
    .collection('script_lines')
    .create({ project: projectId, node: gate.id, character: 'Mara', text: 'Who goes there?', sort_order: 1 }, opts)
  await pb
    .collection('connections')
    .create({ project: projectId, from_node: gate.id, to_node: door.id, label: 'Open it' }, opts)
  const form = new FormData()
  form.append('project', projectId)
  form.append('node', gate.id)
  form.append('file', new Blob([new Uint8Array(PNG_1PX)], { type: 'image/png' }), 'pic.png')
  await pb.collection('media').create(form, opts)
  return { gate: gate.id, door: door.id }
}

/** Makes a verified account as the admin and returns its sign-in. */
export async function verifiedAccount(email: string, name: string): Promise<{ email: string; password: string }> {
  const pb = await adminPB()
  const password = 'KwntoPass99'
  await pb.collection('users').create({ email, name, password, passwordConfirm: password, verified: true })
  return { email, password }
}

/** Fills the sign-in form that the link screen shows. */
export async function signInOnLinkScreen(page: Page, account: { email: string; password: string }): Promise<void> {
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

/** Pretends the tab was hidden or shown again, which the browser does when a person switches tabs. */
export async function setTabVisible(page: Page, visible: boolean): Promise<void> {
  await page.evaluate((shown) => {
    Object.defineProperty(document, 'visibilityState', { value: shown ? 'visible' : 'hidden', configurable: true })
    Object.defineProperty(document, 'hidden', { value: !shown, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }, visible)
}
