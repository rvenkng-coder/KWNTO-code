import { afterEach, describe, expect, test } from 'vitest'
import { createNode, guardedUpdate, memberProject } from './helpers/content.ts'
import { sampleBytes, setQuotaOverride, setStorageSetting, uploadMedia } from './helpers/media.ts'
import { asAdmin, asUser, rawSend } from './helpers/pb.ts'

describe('media limits and quota rules', () => {
  let restoreSetting: (() => Promise<void>) | null = null

  afterEach(async () => {
    if (restoreSetting) {
      await restoreSetting()
      restoreSetting = null
    }
    const admin = await asAdmin()
    const records = await admin.collection('media').getFullList()
    for (const r of records) {
      await admin.collection('media').delete(r.id)
    }
  })

  // Protects: a file whose bytes do not match is refused on the server
  test('a file whose bytes do not match is refused on the server', async () => {
    const { owner, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)

    // PNG bytes as song.mp3
    const r1 = await uploadMedia(
      owner,
      { project: projectId, node: nodeId },
      { name: 'song.mp3', bytes: sampleBytes('png', 100) },
    )
    expect(r1.status).toBe(400)
    const d1 = await r1.json()
    expect(d1.data?.file?.code).toBe('media_not_real')
    expect(d1.message).toBe('This file is not a real MP3 file.')

    // HTML as photo.jpg
    const r2 = await uploadMedia(
      owner,
      { project: projectId, node: nodeId },
      { name: 'photo.jpg', bytes: sampleBytes('html', 100) },
    )
    expect(r2.status).toBe(400)
    const d2 = await r2.json()
    expect(d2.data?.file?.code).toBe('media_not_real')
    expect(d2.message).toBe('This file is not a real JPEG file.')

    // zeros as a.wav
    const r3 = await uploadMedia(
      owner,
      { project: projectId, node: nodeId },
      { name: 'a.wav', bytes: sampleBytes('zeros', 100) },
    )
    expect(r3.status).toBe(400)
    const d3 = await r3.json()
    expect(d3.data?.file?.code).toBe('media_not_real')
    expect(d3.message).toBe('This file is not a real WAV file.')

    // a .gif
    const r4 = await uploadMedia(
      owner,
      { project: projectId, node: nodeId },
      { name: 'a.gif', bytes: sampleBytes('zeros', 100) },
    )
    expect(r4.status).toBe(400)
    const d4 = await r4.json()
    expect(d4.data?.file?.code).toBe('media_type_not_allowed')
    expect(d4.message).toBe('This file type is not allowed. Allowed: WAV, MP3, OGG, M4A, OPUS, JPEG, PNG.')

    // Real MP3 header as a.mp3 -> 200
    const r5 = await uploadMedia(
      owner,
      { project: projectId, node: nodeId },
      { name: 'a.mp3', bytes: sampleBytes('mp3', 100) },
    )
    expect(r5.status).toBe(200)
    const d5 = await r5.json()
    expect(d5.kind).toBe('audio')

    // Refused ones leave no row
    const admin = await asAdmin()
    const rows = await admin
      .collection('media')
      .getFullList({ filter: admin.filter('project = {:p}', { p: projectId }) })
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(d5.id)
  })

  // Protects: files under a trashed node still count toward the quota
  test('files under a trashed node still count toward the quota', async () => {
    const { owner, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)
    const node2Id = await createNode(owner, projectId, chapterId)

    await setQuotaOverride(owner.id, 1000)

    // Upload 600 bytes to node 1
    const r1 = await uploadMedia(
      owner,
      { project: projectId, node: nodeId },
      { name: 'file1.png', bytes: sampleBytes('png', 600) },
    )
    expect(r1.status).toBe(200)

    // Trash node 1
    const TRASHED_AT = '2026-11-16 10:00:00.000Z'
    await guardedUpdate(owner, 'nodes', nodeId, { version: 0, deleted_at: TRASHED_AT })

    // Upload 600 bytes to node 2 -> refused over quota
    const r2 = await uploadMedia(
      owner,
      { project: projectId, node: node2Id },
      { name: 'file2.png', bytes: sampleBytes('png', 600) },
    )
    expect(r2.status).toBe(400)
    const d2 = await r2.json()
    expect(d2.data?.file?.code).toBe('media_over_quota')
  })

  // Protects: quota and size limits follow the admin's settings
  test("quota and size limits follow the admin's settings", async () => {
    const { owner, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)

    await setQuotaOverride(owner.id, 1000)

    // 600 ok
    const r1 = await uploadMedia(
      owner,
      { project: projectId, node: nodeId },
      { name: 'f1.png', bytes: sampleBytes('png', 600) },
    )
    expect(r1.status).toBe(200)

    // 600 refused
    const r2 = await uploadMedia(
      owner,
      { project: projectId, node: nodeId },
      { name: 'f2.png', bytes: sampleBytes('png', 600) },
    )
    expect(r2.status).toBe(400)
    const d2 = await r2.json()
    expect(d2.data?.file?.code).toBe('media_over_quota')
    expect(d2.message).toBe(
      'Not enough storage: this file is 1 KB and you have 1 KB of 1 KB left. Nothing was deleted.',
    )

    // Admin sets override 2000 -> 600 ok
    await setQuotaOverride(owner.id, 2000)
    const r3 = await uploadMedia(
      owner,
      { project: projectId, node: nodeId },
      { name: 'f3.png', bytes: sampleBytes('png', 600) },
    )
    expect(r3.status).toBe(200)

    // Admin sets max_image_mb to 1 -> 1 MiB + 1 byte PNG refused
    restoreSetting = await setStorageSetting('max_image_mb', 1)
    const r4 = await uploadMedia(
      owner,
      { project: projectId, node: nodeId },
      { name: 'f4.png', bytes: sampleBytes('png', 1048576 + 1) },
    )
    expect(r4.status).toBe(400)
    const d4 = await r4.json()
    expect(d4.data?.file?.code).toBe('media_too_large')
    expect(d4.message).toBe('This image file is larger than the 1 MB limit.')
  })

  // Protects: two uploads at once cannot both slip under the quota
  test('two uploads at once cannot both slip under the quota', async () => {
    const { owner, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)

    await setQuotaOverride(owner.id, 1000)

    const [r1, r2] = await Promise.all([
      uploadMedia(owner, { project: projectId, node: nodeId }, { name: 'p1.png', bytes: sampleBytes('png', 600) }),
      uploadMedia(owner, { project: projectId, node: nodeId }, { name: 'p2.png', bytes: sampleBytes('png', 600) }),
    ])

    const statuses = [r1.status, r2.status].sort()
    expect(statuses).toEqual([200, 400])

    const refused = r1.status === 400 ? await r1.json() : await r2.json()
    expect(refused.data?.file?.code).toBe('media_over_quota')

    const admin = await asAdmin()
    const rows = await admin
      .collection('media')
      .getFullList({ filter: admin.filter('uploader = {:u}', { u: owner.id }) })
    expect(rows).toHaveLength(1)
    expect(rows[0].size_bytes).toBe(600)

    const pb = await asUser(owner)
    const storageRes = await rawSend(pb.authStore.token, `/api/kwnto/storage?project=${projectId}`)
    if (storageRes.status === 200) {
      const storage = await storageRes.json()
      expect(storage.usedBytes).toBe(600)
    }
  })

  // Protects: whoever the two parallel uploaders are, many rounds never leave both files in.
  // A quota check that did not go by insertion order kept both in about 1 round in 6, hence the many rounds.
  test('repeated parallel uploads from two people never both stay', async () => {
    const { owner, member, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)
    await setQuotaOverride(owner.id, 1000)
    const admin = await asAdmin()

    for (let round = 0; round < 40; round++) {
      const results = await Promise.all([
        uploadMedia(owner, { project: projectId, node: nodeId }, { name: 'p1.png', bytes: sampleBytes('png', 600) }),
        uploadMedia(member, { project: projectId, node: nodeId }, { name: 'p2.png', bytes: sampleBytes('png', 600) }),
      ])
      const stored = await admin
        .collection('media')
        .getFullList({ filter: admin.filter('project = {:p}', { p: projectId }) })
      expect(stored.length, `round ${round}: files kept`).toBeLessThanOrEqual(1)
      expect(results.filter((r) => r.status === 200).length, `round ${round}: uploads accepted`).toBe(stored.length)
      for (const row of stored) await admin.collection('media').delete(row.id)
    }
  }, 120_000)
})
