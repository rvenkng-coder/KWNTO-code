import { expect, type Locator, type Page } from '@playwright/test'
import { adminPB } from './admin'
import { cards, ownerWithProject } from './editor'
import { PNG_1PX } from './media'
import { projectIdOf } from './share'

/** A real, playable WAV (half a second of silence): a browser that cannot decode a file makes the player show `Media removed`. */
function silentWav(): Buffer {
  const samples = 4000
  const out = Buffer.alloc(44 + samples)
  out.write('RIFF', 0)
  out.writeUInt32LE(36 + samples, 4)
  out.write('WAVEfmt ', 8)
  out.writeUInt32LE(16, 16)
  out.writeUInt16LE(1, 20) // PCM
  out.writeUInt16LE(1, 22) // mono
  out.writeUInt32LE(8000, 24)
  out.writeUInt32LE(8000, 28)
  out.writeUInt16LE(1, 32)
  out.writeUInt16LE(8, 34)
  out.write('data', 36)
  out.writeUInt32LE(samples, 40)
  out.fill(128, 44) // 8-bit silence
  return out
}

export interface PlayStory {
  projectId: string
  gate: string
  door: string
  garden: string
  /** Gate's line spoken by Mara. */
  maraLine: string
  /** Gate's choice `Open the door`. */
  openChoice: string
}

/**
 * Writes a small story as the admin. Chapter 1 holds `Gate` (the start:
 * the hooks make the first node created the start) and `Door`; chapter 2, `The Garden`, holds `Garden`.
 * Gate: three lines (one with no name, one blank), a lighting cue, an image, the choices `Open the door`
 * (to Door) and `Wait` (no target). Door: a WAV, the choices `Go back` (to Gate) and one with no text (to Garden).
 */
export async function seedPlayStory(projectId: string): Promise<PlayStory> {
  const pb = await adminPB()
  const opts = { requestKey: null }
  const first = await pb.collection('chapters').getFirstListItem(pb.filter('project = {:p}', { p: projectId }), opts)
  const second = await pb.collection('chapters').create({ project: projectId, title: 'The Garden', position: 2 }, opts)
  const node = (chapter: string, title: string, x: number) =>
    pb.collection('nodes').create({ project: projectId, chapter, title, color: 'blue', x, y: 40 }, opts)
  const gate = await node(first.id, 'Gate', 40)
  const door = await node(first.id, 'Door', 420)
  const garden = await node(second.id, 'Garden', 40)
  const say = (n: string, character: string, text: string, sort_order: number) =>
    pb.collection('script_lines').create({ project: projectId, node: n, character, text, sort_order }, opts)
  const maraLine = await say(gate.id, 'Mara', 'Who goes there?', 1)
  await say(gate.id, '', 'Rain falls.', 2)
  await say(gate.id, '', '', 3)
  await pb
    .collection('cues')
    .create({ project: projectId, node: gate.id, type: 'lighting', text: 'Dim the lights', sort_order: 1 }, opts)
  const choice = (from: string, to: string | null, label: string) =>
    pb
      .collection('connections')
      .create({ project: projectId, from_node: from, ...(to === null ? {} : { to_node: to }), label }, opts)
  const openChoice = await choice(gate.id, door.id, 'Open the door')
  await choice(gate.id, null, 'Wait')
  await choice(door.id, gate.id, 'Go back')
  await choice(door.id, garden.id, '')
  const upload = (n: string, bytes: Buffer, type: string, name: string) => {
    const form = new FormData()
    form.append('project', projectId)
    form.append('node', n)
    form.append('file', new Blob([new Uint8Array(bytes)], { type }), name)
    return pb.collection('media').create(form, opts)
  }
  await upload(gate.id, PNG_1PX, 'image/png', 'pic.png')
  await upload(door.id, silentWav(), 'audio/wav', 'door.wav')
  return {
    projectId,
    gate: gate.id,
    door: door.id,
    garden: garden.id,
    maraLine: maraLine.id,
    openChoice: openChoice.id,
  }
}

/** Changes text fields of a record as the admin; the content collections refuse an update without the current version. */
export async function changeRecord(collection: string, id: string, fields: Record<string, string>): Promise<void> {
  const pb = await adminPB()
  const current = await pb.collection(collection).getOne(id, { requestKey: null })
  await pb.collection(collection).update(id, { ...fields, version: current.version }, { requestKey: null })
}

/** A new owner with the seeded story, open in the editor once its nodes and media have loaded. */
export async function playableProject(page: Page): Promise<PlayStory> {
  await ownerWithProject(page, 'Story')
  const story = await seedPlayStory(projectIdOf(page))
  const media = page.waitForResponse(
    (r) => r.url().includes('/collections/media/records') && r.request().method() === 'GET',
  )
  await page.reload()
  await media
  await expect(cards(page)).toHaveCount(2)
  return story
}

export const playButton = (page: Page) => page.getByRole('button', { name: 'Play', exact: true })
export const playerDialog = (page: Page) => page.getByRole('dialog', { name: 'Player' })

/** Clicks `Play` and returns the player's dialog. */
export async function openPlayer(page: Page): Promise<Locator> {
  await playButton(page).click()
  const dialog = playerDialog(page)
  await expect(dialog).toBeVisible()
  return dialog
}

/** Clicks the choice with this label and waits for the new node's title. */
export async function pick(dialog: Locator, label: string, nextTitle: string): Promise<void> {
  await dialog.getByTestId('player-choice').filter({ hasText: label }).click()
  await expect(dialog.getByTestId('player-title')).toHaveText(nextTitle)
}
