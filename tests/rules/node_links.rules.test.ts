import { afterEach, describe, expect, test } from 'vitest'
import { createNode, memberProject } from './helpers/content.ts'
import { asAdmin, asUser, createUser, rawSend, type TestUser } from './helpers/pb.ts'
import { addMember } from './helpers/teams.ts'

const PATH = '/api/collections/node_links/records'
const NOT_WEB = 'That is not a web address.'
const ONLY_WEB = 'Only http:// and https:// addresses are allowed.'

async function tokenOf(user: TestUser | null): Promise<string | undefined> {
  return user ? (await asUser(user)).authStore.token : undefined
}

async function addLink(user: TestUser | null, body: Record<string, unknown>): Promise<Response> {
  return rawSend(await tokenOf(user), PATH, { method: 'POST', body })
}

async function listLinks(user: TestUser | null, query = ''): Promise<{ status: number; items: { id: string }[] }> {
  const res = await rawSend(await tokenOf(user), `${PATH}${query}`)
  const json = res.status === 200 ? await res.json() : { items: [] }
  return { status: res.status, items: json.items }
}

async function linkRows(): Promise<number> {
  return (await (await asAdmin()).collection('node_links').getFullList()).length
}

describe('node_links rules and collection', () => {
  afterEach(async () => {
    const admin = await asAdmin()
    for (const r of await admin.collection('node_links').getFullList()) {
      await admin.collection('node_links').delete(r.id)
    }
  })

  // Protects: a member adds a link and the server trims what it stores (C4)
  test('a member adds a link and the server trims it', async () => {
    const { owner, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)

    const res = await addLink(owner, { project: projectId, node: nodeId, creator: owner.id, title: ' Trailer ', url: ' https://example.com/v ' })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.title).toBe('Trailer')
    expect(data.url).toBe('https://example.com/v')
    expect(data.creator).toBe(owner.id)
  })

  // Protects: only a verified member adds, as themself, to their own project (C5)
  test('only a verified member adds a link, as themself, in their own project', async () => {
    const { owner, member, projectId, chapterId, teamId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)
    const outsider = await createUser()
    const unverified = await createUser({ verified: false })
    await addMember(teamId, unverified)
    const other = await memberProject()
    const otherNodeId = await createNode(other.owner, other.projectId, other.chapterId)

    const url = 'https://example.com/v'
    const refused = [
      await addLink(null, { project: projectId, node: nodeId, creator: owner.id, url }),
      await addLink(outsider, { project: projectId, node: nodeId, creator: outsider.id, url }),
      await addLink(unverified, { project: projectId, node: nodeId, creator: unverified.id, url }),
      await addLink(member, { project: projectId, node: nodeId, creator: owner.id, url }),
      await addLink(member, { project: projectId, node: otherNodeId, creator: member.id, url }),
    ]
    for (const res of refused) expect(res.status).not.toBe(200)
    expect(await linkRows()).toBe(0)
  })

  // Protects: the server refuses unsafe addresses with the field error and a clear message (C6)
  test('the server refuses unsafe addresses with a clear message', async () => {
    const { owner, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)
    const base = { project: projectId, node: nodeId, creator: owner.id }

    const cases: [string, string][] = [
      ['javascript:alert(1)', ONLY_WEB],
      ['https://google.com@evil.example', NOT_WEB],
      ['', 'Enter a web address.'],
      ['https://a.example/' + 'x'.repeat(2000), 'The address is longer than 2000 characters.'],
    ]
    for (const [url, message] of cases) {
      const res = await addLink(owner, { ...base, url })
      expect(res.status, url.slice(0, 40)).toBe(400)
      expect((await res.json()).data.url.message).toBe(message)
    }
    expect(await linkRows()).toBe(0)

    const ok = await addLink(owner, { ...base, url: 'HTTPS://OK.example' })
    expect(ok.status).toBe(200)
  })

  // Protects: only team members read links; a filter cannot widen that (C7)
  test('only team members read links', async () => {
    const { owner, member, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)
    const outsider = await createUser()
    const created = await (await addLink(owner, { project: projectId, node: nodeId, creator: owner.id, url: 'https://example.com/v' })).json()

    expect((await listLinks(member)).items.map((i) => i.id)).toEqual([created.id])
    expect((await rawSend(await tokenOf(member), `${PATH}/${created.id}`)).status).toBe(200)

    for (const who of [outsider, null]) {
      expect((await listLinks(who)).items).toHaveLength(0)
      expect((await rawSend(await tokenOf(who), `${PATH}/${created.id}`)).status).toBe(404)
    }
    expect((await listLinks(outsider, `?filter=${encodeURIComponent("id != ''")}`)).items).toHaveLength(0)
    expect((await listLinks(outsider, `?filter=${encodeURIComponent(`title ~ "'; --"`)}`)).items).toHaveLength(0)
  })

  // Protects: a link is never edited; any member deletes; an outsider cannot (C8)
  test('links are never updated and any member deletes', async () => {
    const { owner, member, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)
    const outsider = await createUser()
    const created = await (await addLink(owner, { project: projectId, node: nodeId, creator: owner.id, url: 'https://example.com/v' })).json()
    const one = `${PATH}/${created.id}`

    for (const who of [member, owner, outsider]) {
      const res = await rawSend(await tokenOf(who), one, { method: 'PATCH', body: { title: 'x' } })
      expect(res.status).not.toBe(200)
    }
    expect((await rawSend(await tokenOf(outsider), one, { method: 'DELETE' })).status).not.toBe(204)
    expect(await linkRows()).toBe(1)
    expect((await rawSend(await tokenOf(member), one, { method: 'DELETE' })).status).toBe(204)
    expect(await linkRows()).toBe(0)
  })

  // Protects: links go with their node, project and team (C9)
  test('deleting a node, project or team removes its links', async () => {
    const admin = await asAdmin()
    for (const target of ['nodes', 'projects', 'teams'] as const) {
      const { owner, projectId, chapterId, teamId } = await memberProject()
      const nodeId = await createNode(owner, projectId, chapterId)
      const res = await addLink(owner, { project: projectId, node: nodeId, creator: owner.id, url: 'https://example.com/v' })
      expect(res.status).toBe(200)
      expect(await linkRows()).toBe(1)

      const id = { nodes: nodeId, projects: projectId, teams: teamId }[target]
      await admin.collection(target).delete(id)
      expect(await linkRows(), target).toBe(0)
    }
  })
})
