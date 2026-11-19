import { afterEach, describe, expect, test } from 'vitest'
import { createBackend, type Backend } from '../../frontend/src/backend/client.ts'
import { BackendError } from '../../frontend/src/backend/errors.ts'
import type { MediaEvent } from '../../frontend/src/backend/media-types.ts'
import { createNode, memberProject } from './helpers/content.ts'
import { PNG_1PX, sampleBytes, setQuotaOverride } from './helpers/media.ts'
import { asAdmin, PB_URL, type TestUser } from './helpers/pb.ts'

async function doorFor(user: TestUser): Promise<Backend> {
  const door = createBackend(PB_URL)
  await door.auth.signIn(user.email, user.password)
  return door
}

function recorder() {
  const events: MediaEvent[] = []
  const waiting: Array<{ match: (e: MediaEvent) => boolean; resolve: (e: MediaEvent) => void }> = []
  function onEvent(event: MediaEvent): void {
    events.push(event)
    for (const w of waiting.filter((x) => x.match(event))) {
      waiting.splice(waiting.indexOf(w), 1)
      w.resolve(event)
    }
  }
  function next(match: (e: MediaEvent) => boolean): Promise<MediaEvent> {
    const seen = events.find(match)
    return seen ? Promise.resolve(seen) : new Promise((resolve) => waiting.push({ match, resolve }))
  }
  return { events, onEvent, next }
}

describe('media door rules and integration', () => {
  afterEach(async () => {
    const admin = await asAdmin()
    const records = await admin.collection('media').getFullList()
    for (const r of records) {
      await admin.collection('media').delete(r.id)
    }
  })

  // Protects: the door uploads, lists and serves a file (C4)
  test('the door uploads, lists and serves a file', async () => {
    const { owner, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)
    const door = await doorFor(owner)

    const file = new File([PNG_1PX], 'a.png', { type: 'image/png' })
    const uploaded = await door.media.upload(projectId, nodeId, file)

    expect(uploaded.kind).toBe('image')
    expect(uploaded.sizeBytes).toBe(67)
    expect(uploaded.title).toBe('a.png')
    expect(uploaded.uploaderId).toBe(owner.id)
    expect(uploaded.projectId).toBe(projectId)
    expect(uploaded.nodeId).toBe(nodeId)

    const list = await door.media.list(projectId)
    expect(list).toHaveLength(1)
    expect(list[0]).toEqual(uploaded)

    const token = await door.media.fileToken()
    const url = door.media.fileUrl(uploaded, token)
    const res = await fetch(url)
    expect(res.status).toBe(200)
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(bytes).toEqual(PNG_1PX)
  })

  // Protects: a refused upload says which limit it hit (C5)
  test('a refused upload says which limit it hit', async () => {
    const { owner, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)
    const door = await doorFor(owner)

    // PNG bytes as a.mp3
    const badFile = new File([sampleBytes('png', 100)], 'a.mp3', { type: 'audio/mpeg' })
    let caught1: BackendError | null = null
    try {
      await door.media.upload(projectId, nodeId, badFile)
    } catch (err) {
      if (err instanceof BackendError) caught1 = err
    }
    expect(caught1).not.toBeNull()
    expect(caught1?.kind).toBe('invalid')
    expect(caught1?.fields.file).toBe('This file is not a real MP3 file.')

    // Over a 100-byte override
    await setQuotaOverride(owner.id, 100)
    const overQuotaFile = new File([sampleBytes('png', 600)], 'b.png', { type: 'image/png' })
    let caught2: BackendError | null = null
    try {
      await door.media.upload(projectId, nodeId, overQuotaFile)
    } catch (err) {
      if (err instanceof BackendError) caught2 = err
    }
    expect(caught2).not.toBeNull()
    expect(caught2?.kind).toBe('invalid')
    expect(caught2?.fields.file).toContain('Not enough storage')
  })

  // Protects: removing a file frees its space at once (C6)
  test('removing a file frees its space at once', async () => {
    const { owner, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)
    const door = await doorFor(owner)

    const file = new File([PNG_1PX], 'test.png', { type: 'image/png' })
    const uploaded = await door.media.upload(projectId, nodeId, file)

    const s1 = await door.media.storage()
    expect(s1.usedBytes).toBe(67)

    await door.media.remove(uploaded.id)

    const s2 = await door.media.storage()
    expect(s2.usedBytes).toBe(0)
  })

  // Protects: teammates see uploads and deletes live and outsiders do not (C7)
  test('teammates see uploads and deletes live and outsiders do not', async () => {
    const { owner, member, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)

    const other = await memberProject()
    const otherNodeId = await createNode(other.owner, other.projectId, other.chapterId)

    const doorA = await doorFor(owner)
    const doorB = await doorFor(member)
    const doorOut = await doorFor(other.owner)

    const seenA = recorder()
    const seenOut = recorder()
    const seenOutOwn = recorder()

    const unsubA = await doorA.media.subscribe(projectId, seenA.onEvent)
    const unsubOut = await doorOut.media.subscribe(projectId, seenOut.onEvent)
    const unsubOutOwn = await doorOut.media.subscribe(other.projectId, seenOutOwn.onEvent)

    // Teammate B uploads and deletes in project
    const file = new File([PNG_1PX], 'live.png', { type: 'image/png' })
    const uploaded = await doorB.media.upload(projectId, nodeId, file)
    await seenA.next((e) => e.action === 'create' && e.record.id === uploaded.id)

    await doorB.media.remove(uploaded.id)
    await seenA.next((e) => e.action === 'delete' && e.record.id === uploaded.id)

    // Outsider uploads to their own project (control event)
    const outUpload = await doorOut.media.upload(other.projectId, otherNodeId, file)
    await seenOutOwn.next((e) => e.action === 'create' && e.record.id === outUpload.id)

    // Outsider saw nothing from project A
    expect(seenOut.events).toHaveLength(0)

    // Teammate A saw create then delete
    expect(seenA.events.map((e) => ({ action: e.action, id: e.record.id }))).toEqual([
      { action: 'create', id: uploaded.id },
      { action: 'delete', id: uploaded.id },
    ])

    await unsubA()
    await unsubOut()
    await unsubOutOwn()
  })
})
