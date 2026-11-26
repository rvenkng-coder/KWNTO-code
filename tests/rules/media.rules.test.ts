import { afterEach, describe, expect, test } from 'vitest'
import { createNode, memberProject } from './helpers/content.ts'
import { PNG_1PX, sampleBytes, setQuotaOverride, uploadMedia } from './helpers/media.ts'
import { asAdmin, asAnonymous, asUser, createUser, PB_URL, rawSend } from './helpers/pb.ts'
import { addMember } from './helpers/teams.ts'

describe('media rules and collection', () => {
  afterEach(async () => {
    const admin = await asAdmin()
    const records = await admin.collection('media').getFullList()
    for (const r of records) {
      await admin.collection('media').delete(r.id)
    }
  })

  // Protects: verified member uploads an image and the server names it (C1)
  test('a member uploads an image and the server names it', async () => {
    const { owner, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)

    const res = await uploadMedia(owner, { project: projectId, node: nodeId }, { name: 'My Photo.png', bytes: PNG_1PX })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.kind).toBe('image')
    expect(data.size_bytes).toBe(67)
    expect(data.uploader).toBe(owner.id)
    expect(data.title).toBe('My Photo.png')
    expect(data.file).toMatch(/^[a-z0-9]{15}\.png$/)
    expect(data.file).not.toContain('Photo')
  })

  // Protects: only a verified member uploads, as themself, into their own project (C2)
  test('only a verified member uploads, as themself, into their own project', async () => {
    const { owner, member, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)

    const outsider = await createUser()
    const unverified = await createUser({ verified: false })
    const { teamId: otherTeamId } = await memberProject()
    await addMember(otherTeamId, unverified)

    const other = await memberProject()
    const otherNodeId = await createNode(other.owner, other.projectId, other.chapterId)

    // Signed out
    const r1 = await uploadMedia(null, { project: projectId, node: nodeId }, { name: 'test.png', bytes: PNG_1PX })
    // Verified outsider
    const r2 = await uploadMedia(outsider, { project: projectId, node: nodeId }, { name: 'test.png', bytes: PNG_1PX })
    // Unverified member
    const r3 = await uploadMedia(unverified, { project: projectId, node: nodeId }, { name: 'test.png', bytes: PNG_1PX })
    // Member with uploader set to owner
    const r4 = await uploadMedia(
      member,
      { project: projectId, node: nodeId, uploader: owner.id },
      { name: 'test.png', bytes: PNG_1PX },
    )
    // Member with a node of another project
    const r5 = await uploadMedia(
      member,
      { project: projectId, node: otherNodeId },
      { name: 'test.png', bytes: PNG_1PX },
    )
    // Member sending kind
    const r6 = await uploadMedia(
      member,
      { project: projectId, node: nodeId, kind: 'image' },
      { name: 'test.png', bytes: PNG_1PX },
    )
    // Member sending size_bytes
    const r7 = await uploadMedia(
      member,
      { project: projectId, node: nodeId, size_bytes: 67 },
      { name: 'test.png', bytes: PNG_1PX },
    )
    // Member sending title
    const r8 = await uploadMedia(
      member,
      { project: projectId, node: nodeId, title: 'Forged' },
      { name: 'test.png', bytes: PNG_1PX },
    )

    const statuses = [r1.status, r2.status, r3.status, r4.status, r5.status, r6.status, r7.status, r8.status]
    for (const [i, s] of statuses.entries()) {
      expect(s, `request r${i + 1} status`).not.toBe(200)
    }

    const admin = await asAdmin()
    const list = await admin.collection('media').getFullList()
    expect(list).toHaveLength(0)
  })

  // Protects: only the team can read a media row or its file (C3)
  test('only the team can read a media row or its file', async () => {
    const { owner, member, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)
    const outsider = await createUser()

    const res = await uploadMedia(owner, { project: projectId, node: nodeId }, { name: 'test.png', bytes: PNG_1PX })
    expect(res.status).toBe(200)
    const record = await res.json()

    // Member lists and views
    const memberPb = await asUser(member)
    const memberList = await memberPb.collection('media').getList(1, 10, { filter: `project = "${projectId}"` })
    expect(memberList.items).toHaveLength(1)
    const memberView = await memberPb.collection('media').getOne(record.id)
    expect(memberView.id).toBe(record.id)

    // Outsider lists and views
    const outsiderPb = await asUser(outsider)
    const outsiderList = await outsiderPb.collection('media').getList(1, 10, { filter: `project = "${projectId}"` })
    expect(outsiderList.items).toHaveLength(0)
    await expect(outsiderPb.collection('media').getOne(record.id)).rejects.toThrow()

    // File URL with no token
    const noTokenRes = await fetch(`${PB_URL}/api/files/media/${record.id}/${record.file}`)
    expect(noTokenRes.status).not.toBe(200)

    // File URL with outsider token
    const outsiderToken = await outsiderPb.files.getToken()
    const outsiderFileRes = await fetch(`${PB_URL}/api/files/media/${record.id}/${record.file}?token=${outsiderToken}`)
    expect(outsiderFileRes.status).not.toBe(200)

    // File URL with member token
    const memberToken = await memberPb.files.getToken()
    const memberFileRes = await fetch(`${PB_URL}/api/files/media/${record.id}/${record.file}?token=${memberToken}`)
    expect(memberFileRes.status).toBe(200)
    const bytes = new Uint8Array(await memberFileRes.arrayBuffer())
    expect(bytes).toEqual(PNG_1PX)
  })

  // Protects: media is never edited; only the team lead deletes it (C4)
  test('media is never edited and only the lead deletes it', async () => {
    const { owner, member, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)
    const outsider = await createUser()

    const res = await uploadMedia(member, { project: projectId, node: nodeId }, { name: 'test.png', bytes: PNG_1PX })
    expect(res.status).toBe(200)
    const record = await res.json()

    // Member PATCHes title, size or file -> refused
    const memberPb = await asUser(member)
    await expect(memberPb.collection('media').update(record.id, { title: 'Updated' })).rejects.toThrow()
    await expect(memberPb.collection('media').update(record.id, { size_bytes: 1 })).rejects.toThrow()
    await expect(memberPb.collection('media').update(record.id, { uploader: owner.id })).rejects.toThrow()

    // Outsider and signed-out delete -> refused
    const outsiderPb = await asUser(outsider)
    await expect(outsiderPb.collection('media').delete(record.id)).rejects.toThrow()
    await expect(asAnonymous().collection('media').delete(record.id)).rejects.toThrow()

    // The member who uploaded it still cannot delete it
    await expect(memberPb.collection('media').delete(record.id)).rejects.toThrow()

    // The lead deletes -> the file stops serving
    const ownerPb = await asUser(owner)
    await ownerPb.collection('media').delete(record.id)
    const token = await ownerPb.files.getToken()
    const fileRes = await fetch(`${PB_URL}/api/files/media/${record.id}/${record.file}?token=${token}`)
    expect(fileRes.status).not.toBe(200)
  })

  // Protects: a member removes media, only the lead restores it, and nobody else can (C12)
  test('a member removes media and only the lead restores it', async () => {
    const { owner, member, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)
    const outsider = await createUser()

    const res = await uploadMedia(member, { project: projectId, node: nodeId }, { name: 'a.png', bytes: PNG_1PX })
    const record = await res.json()
    expect(record.removed_at).toBe('')

    // Outsider cannot remove
    await expect(
      (await asUser(outsider)).collection('media').update(record.id, { removed_at: '2026-11-20 08:00:00.000Z' }),
    ).rejects.toThrow()

    // Member removes: the row stays and still counts
    const memberPb = await asUser(member)
    const removed = await memberPb.collection('media').update(record.id, { removed_at: '2026-11-20 08:00:00.000Z' })
    expect(removed.removed_at).not.toBe('')
    expect((await memberPb.collection('media').getOne(record.id)).id).toBe(record.id)

    // Removing and changing something else in one request is refused
    await expect(
      memberPb.collection('media').update(record.id, { removed_at: '2026-11-20 09:00:00.000Z', title: 'x' }),
    ).rejects.toThrow()

    // The member cannot restore
    await expect(memberPb.collection('media').update(record.id, { removed_at: '' })).rejects.toThrow()

    // The lead restores
    const restored = await (await asUser(owner)).collection('media').update(record.id, { removed_at: '' })
    expect(restored.removed_at).toBe('')
  })

  // Protects: a member's upload counts against the lead's quota, not their own (C13)
  test("a member's upload counts against the lead's quota", async () => {
    const { owner, member, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)
    await setQuotaOverride(owner.id, 1000)

    const r1 = await uploadMedia(
      member,
      { project: projectId, node: nodeId },
      { name: 'a.png', bytes: sampleBytes('png', 600) },
    )
    expect(r1.status).toBe(200)
    const kept = await r1.json()

    // The lead's quota is shared by the whole team
    const r2 = await uploadMedia(
      owner,
      { project: projectId, node: nodeId },
      { name: 'b.png', bytes: sampleBytes('png', 600) },
    )
    expect(r2.status).toBe(400)
    expect((await r2.json()).data?.file?.code).toBe('media_over_quota')

    // Removing it hides it but does not free the space
    const memberPb = await asUser(member)
    await memberPb.collection('media').update(kept.id, { removed_at: '2026-11-20 08:00:00.000Z' })
    const r3 = await uploadMedia(
      member,
      { project: projectId, node: nodeId },
      { name: 'c.png', bytes: sampleBytes('png', 600) },
    )
    expect(r3.status).toBe(400)

    // Deleting it for good does
    await (await asUser(owner)).collection('media').delete(kept.id)
    const r4 = await uploadMedia(
      member,
      { project: projectId, node: nodeId },
      { name: 'd.png', bytes: sampleBytes('png', 600) },
    )
    expect(r4.status).toBe(200)
  })

  // Protects: deleting the uploader's account keeps the file with the lead (C14)
  test("deleting the uploader's account keeps the file", async () => {
    const { owner, member, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)
    const res = await uploadMedia(member, { project: projectId, node: nodeId }, { name: 'a.png', bytes: PNG_1PX })
    const record = await res.json()

    const admin = await asAdmin()
    await admin.collection('users').delete(member.id)

    const kept = await admin.collection('media').getOne(record.id)
    expect(kept.uploader).toBe('')
    expect(kept.size_bytes).toBe(67)
  })

  // Protects: a lead with no limits row gets the default quota, and the admin can restore media (C15)
  test('a lead with no limits row gets the default quota and the admin can restore', async () => {
    const { owner, member, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)
    const admin = await asAdmin()
    const row = await admin.collection('user_limits').getFirstListItem(admin.filter('user = {:u}', { u: owner.id }))
    await admin.collection('user_limits').delete(row.id)

    const res = await uploadMedia(member, { project: projectId, node: nodeId }, { name: 'a.png', bytes: PNG_1PX })
    expect(res.status).toBe(200)
    const record = await res.json()

    const storage = await rawSend((await asUser(member)).authStore.token, `/api/kwnto/storage?project=${projectId}`)
    expect(storage.status).toBe(200)
    expect((await storage.json()).quotaBytes).toBe(2147483648)

    await (await asUser(member)).collection('media').update(record.id, { removed_at: '2026-11-20 08:00:00.000Z' })
    const restored = await admin.collection('media').update(record.id, { removed_at: '' })
    expect(restored.removed_at).toBe('')
  })

  // Protects: deleting a team removes its media (C11)
  test('deleting a team removes its media', async () => {
    const { owner, teamId, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)

    const res = await uploadMedia(owner, { project: projectId, node: nodeId }, { name: 'test.png', bytes: PNG_1PX })
    expect(res.status).toBe(200)
    const record = await res.json()

    const ownerPb = await asUser(owner)
    await ownerPb.collection('teams').delete(teamId)

    const admin = await asAdmin()
    await expect(admin.collection('media').getOne(record.id)).rejects.toThrow()
  })

  // Protects: stored files are served so they cannot run as a page (C6)
  test('stored files are served so they cannot run as a page', async () => {
    const { owner, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)

    // 1. Regular PNG
    const r1 = await uploadMedia(owner, { project: projectId, node: nodeId }, { name: 'photo.png', bytes: PNG_1PX })
    expect(r1.status).toBe(200)
    const d1 = await r1.json()

    // 2. Polyglot PNG
    const polyglotBytes = new Uint8Array([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      ...Buffer.from('<script>alert(1)</script>'),
    ])
    const r2 = await uploadMedia(owner, { project: projectId, node: nodeId }, { name: 'x.png', bytes: polyglotBytes })
    expect(r2.status).toBe(200)
    const d2 = await r2.json()

    const ownerPb = await asUser(owner)
    const token = await ownerPb.files.getToken()

    for (const d of [d1, d2]) {
      const res = await fetch(`${PB_URL}/api/files/media/${d.id}/${d.file}?token=${token}`)
      expect(res.status).toBe(200)
      expect(res.headers.get('x-content-type-options')).toBe('nosniff')
      expect(res.headers.get('content-type')).toContain('image/png')
      const csp = res.headers.get('content-security-policy') ?? ''
      expect(csp).toContain("default-src 'none'")
      expect(csp).toContain("img-src 'self'")
      expect(csp).toContain('sandbox')
    }
  })

  // Protects: the storage route shows the lead's usage to the team and nobody else (C10)
  test("the storage route shows the lead's usage to the team and nobody else", async () => {
    const { owner, member, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)

    // Owner uploads 67 bytes, member uploads 600 bytes: both count for the lead
    const r1 = await uploadMedia(owner, { project: projectId, node: nodeId }, { name: 'f1.png', bytes: PNG_1PX })
    expect(r1.status).toBe(200)
    const r2 = await uploadMedia(
      member,
      { project: projectId, node: nodeId },
      { name: 'f2.png', bytes: sampleBytes('png', 600) },
    )
    expect(r2.status).toBe(200)

    const path = `/api/kwnto/storage?project=${projectId}`
    const ownerRes = await rawSend((await asUser(owner)).authStore.token, path)
    expect(ownerRes.status).toBe(200)
    const data = await ownerRes.json()
    expect(data.usedBytes).toBe(667)
    expect(data.quotaBytes).toBe(2147483648)
    expect(data.isLead).toBe(true)
    expect(data.maxBytes.video).toBe(209715200)
    expect(data.allowedTypes).toEqual(['wav', 'mp3', 'ogg', 'm4a', 'opus', 'jpeg', 'png'])

    // The member sees the same meter but is not the lead
    const memberRes = await rawSend((await asUser(member)).authStore.token, path)
    expect(memberRes.status).toBe(200)
    const memberData = await memberRes.json()
    expect(memberData.usedBytes).toBe(667)
    expect(memberData.isLead).toBe(false)

    // An outsider gets 404; no project is a 400
    const outsider = await createUser()
    const outsiderToken = (await asUser(outsider)).authStore.token
    expect((await rawSend(outsiderToken, path)).status).toBe(404)
    expect((await rawSend(outsiderToken, '/api/kwnto/storage')).status).toBe(400)

    // Signed out -> 401
    expect((await rawSend(undefined, path)).status).toBe(401)

    // Unverified -> 403
    const unverified = await createUser({ verified: false })
    const unverifiedPb = await asUser(unverified)
    expect((await rawSend(unverifiedPb.authStore.token, path)).status).toBe(403)
  })
})
