import { afterEach, describe, expect, test } from 'vitest'
import { createNode, memberProject } from './helpers/content.ts'
import { PNG_1PX, uploadMedia } from './helpers/media.ts'
import { asAdmin, asAnonymous, asUser, createUser, PB_URL } from './helpers/pb.ts'
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

    const res = await uploadMedia(
      owner,
      { project: projectId, node: nodeId },
      { name: 'My Photo.png', bytes: PNG_1PX },
    )
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
    const r4 = await uploadMedia(member, { project: projectId, node: nodeId, uploader: owner.id }, { name: 'test.png', bytes: PNG_1PX })
    // Member with a node of another project
    const r5 = await uploadMedia(member, { project: projectId, node: otherNodeId }, { name: 'test.png', bytes: PNG_1PX })
    // Member sending kind
    const r6 = await uploadMedia(member, { project: projectId, node: nodeId, kind: 'image' }, { name: 'test.png', bytes: PNG_1PX })
    // Member sending size_bytes
    const r7 = await uploadMedia(member, { project: projectId, node: nodeId, size_bytes: 67 }, { name: 'test.png', bytes: PNG_1PX })
    // Member sending title
    const r8 = await uploadMedia(member, { project: projectId, node: nodeId, title: 'Forged' }, { name: 'test.png', bytes: PNG_1PX })

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

    const res = await uploadMedia(
      owner,
      { project: projectId, node: nodeId },
      { name: 'test.png', bytes: PNG_1PX },
    )
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

  // Protects: media is never edited and only members delete it (C4)
  test('media is never edited and only members delete it', async () => {
    const { owner, member, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)
    const outsider = await createUser()

    const res = await uploadMedia(
      owner,
      { project: projectId, node: nodeId },
      { name: 'test.png', bytes: PNG_1PX },
    )
    expect(res.status).toBe(200)
    const record = await res.json()

    // Member PATCHes title -> refused
    const memberPb = await asUser(member)
    await expect(memberPb.collection('media').update(record.id, { title: 'Updated' })).rejects.toThrow()

    // Outsider deletes -> refused
    const outsiderPb = await asUser(outsider)
    await expect(outsiderPb.collection('media').delete(record.id)).rejects.toThrow()

    // Signed-out deletes -> refused
    const anonPb = asAnonymous()
    await expect(anonPb.collection('media').delete(record.id)).rejects.toThrow()

    // Member delete -> 204
    await memberPb.collection('media').delete(record.id)

    // File URL no longer serves
    const memberToken = await memberPb.files.getToken()
    const fileRes = await fetch(`${PB_URL}/api/files/media/${record.id}/${record.file}?token=${memberToken}`)
    expect(fileRes.status).not.toBe(200)
  })

  // Protects: deleting a team removes its media (C11)
  test('deleting a team removes its media', async () => {
    const { owner, teamId, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)

    const res = await uploadMedia(
      owner,
      { project: projectId, node: nodeId },
      { name: 'test.png', bytes: PNG_1PX },
    )
    expect(res.status).toBe(200)
    const record = await res.json()

    const ownerPb = await asUser(owner)
    await ownerPb.collection('teams').delete(teamId)

    const admin = await asAdmin()
    await expect(admin.collection('media').getOne(record.id)).rejects.toThrow()
  })
})
