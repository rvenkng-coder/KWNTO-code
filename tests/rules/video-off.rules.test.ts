import { afterEach, describe, expect, test } from 'vitest'
import { createNode, memberProject } from './helpers/content.ts'
import { sampleBytes, setStorageSetting, uploadMedia } from './helpers/media.ts'
import { asAdmin } from './helpers/pb.ts'

const MESSAGE = 'This file type is not allowed. Allowed: WAV, MP3, OGG, M4A, OPUS, JPEG, PNG.'

describe('video uploads are off by decision (plan 2026-11-21-node-links, D1)', () => {
  afterEach(async () => {
    const admin = await asAdmin()
    for (const r of await admin.collection('media').getFullList()) {
      await admin.collection('media').delete(r.id)
    }
  })

  // Protects: the server refuses mp4 and mov with the allowed list in the message (C5)
  test('the server refuses mp4 and mov', async () => {
    const { owner, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)

    for (const [name, type] of [['clip.mp4', 'mp4'], ['clip.mov', 'mov']] as const) {
      const res = await uploadMedia(owner, { project: projectId, node: nodeId }, { name, bytes: sampleBytes(type, 200) })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.data.file.message).toBe(MESSAGE)
    }

    const admin = await asAdmin()
    expect(await admin.collection('media').getFullList()).toHaveLength(0)
  })

  // Protects: the switch is the admin setting, not hard-coded, so the admin can turn video back on (C7)
  test('the admin can switch video back on', async () => {
    const { owner, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)

    const restore = await setStorageSetting('allowed_types', ['wav', 'mp3', 'mov', 'mp4', 'jpeg', 'png'])
    try {
      const res = await uploadMedia(owner, { project: projectId, node: nodeId }, { name: 'clip.mp4', bytes: sampleBytes('mp4', 200) })
      expect(res.status).toBe(200)
      expect((await res.json()).kind).toBe('video')
    } finally {
      await restore()
    }

    const again = await uploadMedia(owner, { project: projectId, node: nodeId }, { name: 'clip2.mp4', bytes: sampleBytes('mp4', 200) })
    expect(again.status).toBe(400)
  })
})
