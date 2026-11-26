// A scripted walk of design section 6 (plus sharing, import/export) against the demo app, one browser per run:
//   node walk.mjs chromium|firefox
// Records PASS or FAIL per feature, keeps going after a failure, and writes screenshots next to this file.
import fs from 'node:fs'
import { chromium, firefox } from '/home/paeng/Documents/06-github-projects/KWNTO/KWNTO-code-player/node_modules/playwright-core/index.mjs'
import { expect } from '/home/paeng/Documents/06-github-projects/KWNTO/KWNTO-code-player/node_modules/@playwright/test/index.mjs'

const BASE = 'http://localhost:5190'
const PROJECT = `Walk ${process.argv[2]} ${Date.now() % 100000}`
const browserName = process.argv[2]
const OUT = `/tmp/claude-1000/-home-paeng-Documents-06-github-projects-KWNTO-KWNTO-code-player/e0d17b2d-dcd2-4dff-9efa-2003f9e2764b/scratchpad/m8m9/${browserName}`
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

const T = { timeout: 15000 }
const results = []
let page
let context
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==', 'base64')
function wav() {
  const b = Buffer.alloc(44 + 4000, 128)
  b.write('RIFF', 0); b.writeUInt32LE(4036, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28)
  b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(4000, 40)
  return b
}

let current = ''
async function step(ref, name, fn) {
  current = `${ref} ${name}`
  try {
    await fn()
    results.push({ ref, name, ok: true })
    console.log(`PASS ${ref} ${name}`)
  } catch (err) {
    const msg = String(err.message ?? err).split('\n').slice(0, 4).join(' | ').slice(0, 300)
    results.push({ ref, name, ok: false, msg })
    console.log(`FAIL ${ref} ${name}\n     ${msg}`)
    try { await page.screenshot({ path: `${OUT}/FAIL-${ref.replace(/\W+/g, '_')}.png` }) } catch { /* page may be gone */ }
    try { await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await context.setOffline(false) } catch { /* ignore */ }
  }
}

const ids = {}
const titles = {}
const cards = () => page.getByTestId('node-card')
const card = (key) => page.locator(`[data-testid="node-card"][data-node-id="${ids[key]}"]`)
const panel = () => page.getByTestId('editor-panel')
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })

async function nodeIds() { return new Set(await cards().evaluateAll((els) => els.map((e) => e.getAttribute('data-node-id')))) }
async function addNodeAt(key, x, y) {
  const before = await nodeIds()
  await page.getByTestId('canvas').dblclick({ position: { x, y } })
  await expect(cards()).toHaveCount(before.size + 1, T)
  const after = await nodeIds()
  ids[key] = [...after].find((id) => !before.has(id))
}
async function show(key) {
  if (await card(key).count() > 0) return
  await page.getByTestId('search-input').fill(titles[key] ?? key)
  const results = page.getByTestId('search-results')
  await expect(results).toBeVisible(T)
  await results.getByRole('button').first().click()
  await expect(card(key)).toBeVisible(T)
}
const go = async (key) => { await show(key); return card(key) }
async function setTitle(key, newTitle) {
  titles[key] = newTitle
  await (await go(key)).click({ position: { x: 30, y: 12 } })
  const title = panel().getByLabel('Title', { exact: true })
  await expect(title).toBeVisible(T)
  await title.fill(newTitle)
  await title.blur()
  await expect(card(key)).toContainText(newTitle, T)
}
async function openTrash() {
  await page.getByRole('button', { name: 'All chapters' }).click()
  await page.getByRole('menuitem', { name: 'Trash' }).click()
  await expect(page.getByRole('dialog', { name: 'Trash' })).toBeVisible(T)
}

const launcher = { chromium, firefox }[browserName]
const browser = await launcher.launch()
context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
page = await context.newPage()
const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(`pageerror during [${current}]: ${e.message} | ${(e.stack ?? '').split('\n').slice(0, 4).join(' / ')}`.slice(0, 700)))
page.on('response', (r) => { if (r.status() >= 400) consoleErrors.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace(BASE, '').slice(0, 90)} during [${current}]`) })

await step('5', 'sign in with an account, see the team and its project list', async () => {
  await page.goto(BASE)
  await page.getByLabel('Email').fill('demo@kwnto.test')
  await page.getByLabel('Password').fill('KwntoDemo99')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByTestId('team-list')).toBeVisible(T)
})
await step('5', 'open the team and create a project', async () => {
  await page.getByTestId('team-list').getByRole('button', { name: 'Demo Crew', exact: true }).click()
  await expect(page.getByTestId('member-list')).toHaveAttribute('data-loaded', 'true', T)
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByLabel('Project name').fill(PROJECT)
  await page.getByRole('button', { name: 'Create project' }).click()
  await page.getByTestId('project-list').getByRole('button', { name: PROJECT, exact: true }).click()
  await expect(page.getByTestId('editor-canvas')).toBeVisible(T)
  await expect(page.getByRole('tab', { name: 'Chapter 1' })).toBeVisible(T)
})

await step('6.1', 'add freeform nodes on the canvas (double-click)', async () => {
  await addNodeAt('Gate', 60, 60); await addNodeAt('Door', 440, 60); await addNodeAt('Cellar', 820, 60)
})
await step('6.1', 'give each node a title (Gate, Door, Cellar)', async () => {
  await setTitle('Gate', 'Gate'); await setTitle('Door', 'Door'); await setTitle('Cellar', 'Cellar')
})
await step('6.1', 'choose a node header colour', async () => {
  await (await go('Gate')).click({ position: { x: 30, y: 12 } })
  await panel().getByRole('button', { name: 'Colour red' }).click()
  await expect(panel().getByRole('button', { name: 'Colour red' })).toHaveAttribute('aria-pressed', 'true', T)
})
await step('6.1', 'pan the canvas by dragging empty space', async () => {
  const vp = page.locator('.react-flow__viewport')
  const before = await vp.getAttribute('style')
  const c = page.getByTestId('canvas')
  const box = await c.boundingBox()
  await page.mouse.move(box.x + 300, box.y + 500)
  await page.mouse.down(); await page.mouse.move(box.x + 220, box.y + 460, { steps: 6 }); await page.mouse.up()
  expect(await vp.getAttribute('style')).not.toBe(before)
})
await step('6.1', 'drag a node and it stays where it is dropped', async () => {
  const c = card('Cellar')
  const b0 = await c.boundingBox()
  await page.mouse.move(b0.x + 30, b0.y + 12); await page.mouse.down()
  await page.mouse.move(b0.x + 30, b0.y + 120, { steps: 8 }); await page.mouse.up()
  const b1 = await c.boundingBox()
  expect(Math.abs(b1.y - b0.y)).toBeGreaterThan(40)
})
await step('6.1', 'connect nodes with choices (Gate to Door, Door to Cellar)', async () => {
  const connect = async (from, to) => {
    await page.locator(`[data-node-id="${ids[from]}"] [data-testid="new-choice-handle"]`).dragTo(page.locator(`[data-node-id="${ids[to]}"] .react-flow__handle.target`))
  }
  await connect('Gate', 'Door'); await connect('Door', 'Cellar')
  await (await go('Gate')).click({ position: { x: 30, y: 12 } })
  await expect(card('Gate').getByTestId('choice-row')).toHaveCount(1, T)
  await panel().getByLabel('Choice text').first().fill('Open it'); await panel().getByLabel('Choice text').first().blur()
  await expect(card('Gate').getByTestId('choice-row')).toContainText('Open it', T)
})
await step('6.1', 'Start, End and Unreachable markers', async () => {
  await addNodeAt('Lost', 60, 420); await setTitle('Lost', 'Lost')
  await show('Gate')
  await expect(card('Gate')).toContainText('Start', T)
  await show('Cellar')
  await expect(card('Cellar')).toContainText('End', T)
  await show('Lost')
  await expect(card('Lost')).toContainText('Unreachable', T)
})
await step('6.1', 'make another node the start node, then back', async () => {
  await (await go('Door')).click({ position: { x: 30, y: 12 } })
  await panel().getByRole('button', { name: 'Make start node' }).click()
  await expect(card('Door')).toContainText('Start', T)
  await (await go('Gate')).click({ position: { x: 30, y: 12 } })
  await panel().getByRole('button', { name: 'Make start node' }).click()
  await expect(card('Gate')).toContainText('Start', T)
})
await step('6.1', 'undo and redo a change', async () => {
  await setTitle('Lost', 'Lost2')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(card('Lost')).not.toContainText('Lost2', T)
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(card('Lost')).toContainText('Lost2', T)
})
await step('6.1', 'copy and paste a node', async () => {
  const before = await nodeIds()
  await (await go('Lost')).click({ position: { x: 30, y: 12 } })
  await page.getByRole('button', { name: 'Copy' }).click()
  await page.getByRole('button', { name: 'Paste' }).click()
  await expect(cards()).toHaveCount(before.size + 1, T)
  ids.Copy = [...(await nodeIds())].find((id) => !before.has(id))
})
await step('6.1', 'select several nodes at once', async () => {
  await (await go('Gate')).click({ position: { x: 30, y: 12 } })
  await (await go('Door')).click({ modifiers: ['Control'], position: { x: 30, y: 12 } })
  await expect(panel()).toContainText('2', T)
  await page.getByTestId('canvas').click({ position: { x: 600, y: 520 } })
})
await step('6.1', 'minimap shows and hides', async () => {
  if (await page.getByRole('button', { name: 'Hide minimap' }).count()) await page.getByRole('button', { name: 'Hide minimap' }).click()
  await expect(page.locator('.react-flow__minimap')).toHaveCount(0, T)
  await page.getByRole('button', { name: 'Show minimap' }).click()
  await expect(page.locator('.react-flow__minimap')).toBeVisible(T)
  await page.getByRole('button', { name: 'Hide minimap' }).click()
  await expect(page.locator('.react-flow__minimap')).toHaveCount(0, T)
})
await step('6.1', 'header search jumps to a node by title', async () => {
  await page.getByTestId('search-input').fill('Cellar')
  const results = page.getByTestId('search-results')
  await expect(results).toBeVisible(T)
  await results.getByRole('button').first().click().catch(async () => { await results.locator('li, [role=option]').first().click() })
  await expect(panel().getByLabel('Title', { exact: true })).toHaveValue('Cellar', T)
})
await shot('canvas-light')

await step('6.2', 'write script lines with a character name', async () => {
  await (await go('Gate')).click({ position: { x: 30, y: 12 } })
  await panel().getByRole('button', { name: 'Add line' }).click()
  const row = panel().getByTestId('line-row').first()
  await row.getByLabel('Character').fill('ANNA'); await row.getByLabel('Character').blur()
  await row.getByLabel('Line text').fill('Who goes there?'); await row.getByLabel('Line text').blur()
  await expect(card('Gate')).toContainText('ANNA', T)
})
await step('6.2', 'add an A/V cue and a lighting cue', async () => {
  await panel().getByRole('button', { name: 'Add cue' }).click()
  await panel().getByLabel('Cue type').first().selectOption('lighting')
  await panel().getByLabel('Cue text').first().fill('Dim the lights'); await panel().getByLabel('Cue text').first().blur()
  await expect(card('Gate')).toContainText('Dim the lights', T)
})
await step('6.2', 'upload an image and audio file; both play or show in the panel', async () => {
  const input = panel().getByLabel('Add media')
  await input.setInputFiles({ name: 'pic.png', mimeType: 'image/png', buffer: PNG })
  await expect(panel().getByTestId('media-item')).toHaveCount(1, T)
  await input.setInputFiles({ name: 'door.wav', mimeType: 'audio/wav', buffer: wav() })
  await expect(panel().getByTestId('media-item')).toHaveCount(2, T)
  await expect(panel().locator('audio')).toHaveCount(1, T)
  await expect(panel().getByTestId('storage-meter')).toBeVisible(T)
})
await step('6.2', 'a file that is not what its name says is refused', async () => {
  const input = panel().getByLabel('Add media')
  await input.setInputFiles({ name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('<!doctype html><script>alert(1)</script>') })
  await expect(panel().getByRole('alert')).toBeVisible(T)
  await expect(panel().getByTestId('media-item')).toHaveCount(2, T)
})
await step('6.2', 'add a link to a video (video upload is off)', async () => {
  await panel().getByLabel('Link title').fill('Trailer')
  await panel().getByLabel('Link address').fill('https://example.com/trailer')
  await panel().getByRole('button', { name: 'Add link' }).click()
  await expect(panel().getByTestId('link-item')).toHaveCount(1, T)
})

await step('6.3', 'add chapters as tabs, rename one, switch between them', async () => {
  await page.getByRole('button', { name: 'Add chapter' }).click()
  await expect(page.getByRole('tab', { name: 'Chapter 2' })).toBeVisible(T)
  await page.getByRole('tab', { name: 'Chapter 2' }).dblclick()
  const box = page.getByRole('textbox', { name: 'Chapter title' })
  await box.fill('The Garden'); await box.press('Enter')
  await expect(page.getByRole('tab', { name: 'The Garden' })).toBeVisible(T)
  await addNodeAt('Roses', 100, 100)
  await setTitle('Roses', 'Roses')
  await page.getByRole('tab', { name: 'Chapter 1' }).click()
  await expect(card('Gate')).toBeVisible(T)
})
await step('6.1', 'link a node to a node in another chapter (cross-chapter tag)', async () => {
  await (await go('Door')).click({ position: { x: 30, y: 12 } })
  await panel().getByRole('button', { name: 'Link to another chapter' }).click()
  await page.getByLabel('Find a node').fill('Roses')
  await page.getByTestId('picker-results').getByRole('button').first().click().catch(async () => { await page.getByTestId('picker-results').locator('li').first().click() })
  await expect(card('Door').getByTestId('cross-link')).toBeVisible(T)
})
await step('6.3', 'close a chapter tab and reopen it from the list', async () => {
  await page.getByRole('button', { name: 'Close The Garden' }).click()
  await expect(page.getByRole('tab', { name: 'The Garden' })).toHaveCount(0, T)
  await page.getByRole('button', { name: 'All chapters' }).click()
  await page.getByRole('menuitem', { name: 'The Garden' }).click()
  await expect(page.getByRole('tab', { name: 'The Garden' })).toBeVisible(T)
  await page.getByRole('tab', { name: 'Chapter 1' }).click()
})
await step('6.8', 'move a node to the trash and restore it', async () => {
  const before = await cards().count()
  await (await go('Copy')).click({ position: { x: 30, y: 12 } })
  await page.keyboard.press('Delete')
  await expect(cards()).toHaveCount(before - 1, T)
  await openTrash()
  await expect(page.getByRole('dialog', { name: 'Trash' })).toContainText('30 days left', T)
  await page.getByRole('dialog', { name: 'Trash' }).getByRole('button', { name: 'Restore' }).first().click()
  await expect(cards()).toHaveCount(before, T)
  await page.getByRole('button', { name: 'Close trash' }).click()
})

await step('6.4', 'Player Mode: start, choose, chapter name, back, restart, history', async () => {
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Player' })
  await expect(d.getByTestId('player-title')).toHaveText('Gate', T)
  await expect(d.getByTestId('player-line')).toContainText('Who goes there?', T)
  await expect(d.getByTestId('player-media')).toHaveCount(2, T)
  await expect(d).not.toContainText('Dim the lights')
  await shot('player-gate')
  await d.getByTestId('player-choice').first().click()
  await expect(d.getByTestId('player-title')).toHaveText('Door', T)
  await d.getByRole('button', { name: 'History' }).click()
  await expect(d.getByTestId('player-history').getByRole('listitem')).toHaveCount(2, T)
  await d.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(d.getByTestId('player-title')).toHaveText('Gate', T)
  await d.getByTestId('player-choice').first().click()
  await d.getByRole('button', { name: 'Restart' }).click()
  await expect(d.getByTestId('player-title')).toHaveText('Gate', T)
  await page.keyboard.press('Escape')
  await expect(d).toBeHidden(T)
})
await step('6.5', 'export the map as PDF, Word, JPG and PNG', async () => {
  const exportAs = async (format) => {
    await page.getByRole('button', { name: 'Export map', exact: true }).click()
    const dlg = page.getByRole('dialog', { name: 'Export map' })
    await dlg.getByRole('radio', { name: format, exact: true }).check()
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), dlg.getByRole('button', { name: 'Export', exact: true }).click()])
    const stream = await download.createReadStream(); const chunks = []
    for await (const c of stream) chunks.push(c)
    return { name: download.suggestedFilename(), bytes: Buffer.concat(chunks) }
  }
  const pdf = await exportAs('PDF'); expect(pdf.name).toMatch(/\.pdf$/); expect(pdf.bytes.subarray(0, 5).toString()).toBe('%PDF-')
  fs.writeFileSync(`${OUT}/export.pdf`, pdf.bytes)
  const docx = await exportAs('Word'); expect(docx.name).toMatch(/\.docx$/); expect(docx.bytes.subarray(0, 2).toString()).toBe('PK')
  const jpg = await exportAs('JPG'); expect(jpg.name).toMatch(/\.jpg$/); expect(jpg.bytes[0]).toBe(0xff)
  const png = await exportAs('PNG'); expect(png.name).toMatch(/\.png$/); expect(png.bytes.subarray(1, 4).toString()).toBe('PNG')
  fs.writeFileSync(`${OUT}/export.png`, png.bytes)
})
await step('6.6', 'light and dark theme toggle', async () => {
  const before = await page.locator('html').getAttribute('data-theme')
  await page.getByRole('switch', { name: 'Dark theme' }).click()
  const after = await page.locator('html').getAttribute('data-theme')
  expect(after).not.toBe(before)
  await shot(`theme-${after}`)
  await page.getByRole('switch', { name: 'Dark theme' }).click()
  expect(await page.locator('html').getAttribute('data-theme')).toBe(before)
  await shot(`theme-${before}`)
})
await step('6.7', 'offline: edit, see the waiting count, reconnect, change is saved', async () => {
  await context.setOffline(true)
  await expect(page.getByTestId('sync-status')).toContainText('Offline', T)
  await setTitle('Gate', 'Gate offline')
  await expect(page.getByTestId('sync-status')).toContainText(/1|waiting/i, T)
  await shot('offline')
  await context.setOffline(false)
  await expect(page.getByTestId('sync-status')).not.toContainText('Offline', T)
  await page.waitForTimeout(3000)
  await page.reload()
  await expect(card('Gate')).toContainText('Gate offline', T)
  await setTitle('Gate', 'Gate')
})
await step('8b', 'export and import the project file (JSON)', async () => {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: 'Export project file' }).click()])
  const p = `${OUT}/project.json`; await download.saveAs(p)
  expect(JSON.parse(fs.readFileSync(p, 'utf8')).format).toBe('kwnto-project')
  await page.getByRole('button', { name: 'Back to teams' }).click()
  await page.getByTestId('team-list').getByRole('button', { name: 'Demo Crew', exact: true }).click()
  await expect(page.getByTestId('member-list')).toHaveAttribute('data-loaded', 'true', T)
  await page.getByLabel('Choose project file').setInputFiles(p)
  await expect(page.getByRole('banner')).toContainText('(imported)', T)
})

let address
await step('5', 'share: make a view link and a comment link', async () => {
  await page.getByRole('button', { name: 'Back to teams' }).click()
  await page.getByTestId('team-list').getByRole('button', { name: 'Demo Crew', exact: true }).click()
  await expect(page.getByTestId('member-list')).toHaveAttribute('data-loaded', 'true', T)
  await page.getByTestId('project-list').getByRole('button', { name: PROJECT, exact: true }).click()
  await expect(page.getByTestId('editor-canvas')).toBeVisible(T)
  await page.getByRole('button', { name: 'Share' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('Who can open it').selectOption({ label: 'Can view' })
  await dlg.getByLabel('Kind').selectOption({ label: 'Live' })
  await dlg.getByRole('button', { name: 'Create link' }).click()
  await expect(dlg.getByTestId('link-row')).toHaveCount(1, T)
  address = await dlg.getByTestId('link-row').first().getByLabel('Link address').inputValue()
  expect(address).toContain('/#/s/')
  await page.keyboard.press('Escape').catch(() => {})
})
await step('5', 'a view link opens without an account, read-only, and can be played', async () => {
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const guest = await ctx2.newPage()
  await guest.goto(address)
  await expect(guest.getByRole('heading', { name: PROJECT })).toBeVisible(T)
  await expect(guest.getByTestId('node-card').first()).toBeVisible(T)
  await expect(guest.getByTestId('tool-strip')).toHaveCount(0)
  await guest.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(guest.getByRole('dialog', { name: 'Player' }).getByTestId('player-title')).toHaveText('Gate', T)
  await guest.screenshot({ path: `${OUT}/guest-player.png` })
  await ctx2.close()
})

await shot('final')
console.log(`\nconsole/page errors seen: ${consoleErrors.length}`)
for (const e of consoleErrors.slice(0, 5)) console.log('  ' + e)
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ browser: browserName, results, consoleErrors }, null, 2))
const failed = results.filter((r) => !r.ok)
console.log(`\n${browserName}: ${results.length - failed.length} of ${results.length} steps passed`)
await browser.close()
