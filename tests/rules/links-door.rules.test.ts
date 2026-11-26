import { afterEach, describe, expect, test } from 'vitest'
import { createBackend, type Backend } from '../../frontend/src/backend/client.ts'
import { BackendError } from '../../frontend/src/backend/errors.ts'
import type { LinkEvent } from '../../frontend/src/backend/link-types.ts'
import { checkLinkUrl } from '../../frontend/src/features/editor/links/linkCheck.ts'
import { createNode, memberProject } from './helpers/content.ts'
import { asAdmin, createUser, PB_URL, type TestUser } from './helpers/pb.ts'

async function doorFor(user: TestUser): Promise<Backend> {
  const door = createBackend(PB_URL)
  await door.auth.signIn(user.email, user.password)
  return door
}

function recorder() {
  const events: LinkEvent[] = []
  const waiting: Array<{ match: (e: LinkEvent) => boolean; resolve: (e: LinkEvent) => void }> = []
  function onEvent(event: LinkEvent): void {
    events.push(event)
    for (const w of waiting.filter((x) => x.match(event))) {
      waiting.splice(waiting.indexOf(w), 1)
      w.resolve(event)
    }
  }
  function next(match: (e: LinkEvent) => boolean): Promise<LinkEvent> {
    const seen = events.find(match)
    return seen ? Promise.resolve(seen) : new Promise((resolve) => waiting.push({ match, resolve }))
  }
  return { events, onEvent, next }
}

describe('links door rules and integration', () => {
  afterEach(async () => {
    const admin = await asAdmin()
    for (const r of await admin.collection('node_links').getFullList()) {
      await admin.collection('node_links').delete(r.id)
    }
  })

  // Protects: a member adds, lists and removes a link through the door (C4)
  test('a member adds, lists and removes a link through the door', async () => {
    const { owner, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)
    const door = await doorFor(owner)

    const link = await door.links.add(projectId, nodeId, 'Trailer', 'https://example.com/v')
    expect(link).toMatchObject({
      projectId,
      nodeId,
      creatorId: owner.id,
      title: 'Trailer',
      url: 'https://example.com/v',
    })
    expect((await door.links.list(projectId)).map((l) => l.id)).toEqual([link.id])

    await door.links.remove(link.id)
    expect(await door.links.list(projectId)).toEqual([])
  })

  // Protects: the server's refusal reaches the caller with its message (C5)
  test('a refused address reaches the caller with its message', async () => {
    const { owner, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)
    const door = await doorFor(owner)

    const error = await door.links.add(projectId, nodeId, '', 'javascript:alert(1)').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(BackendError)
    expect((error as BackendError).fields.url).toBe('Only http:// and https:// addresses are allowed.')
  })

  // Protects: teammates see links live, outsiders do not, and the client check agrees with the server (C6)
  test('teammates see links live, outsiders do not, and the client check agrees with the server', async () => {
    const { owner, member, projectId, chapterId } = await memberProject()
    const nodeId = await createNode(owner, projectId, chapterId)
    const outsider = await createUser()
    const doorA = await doorFor(owner)
    const doorB = await doorFor(member)
    const doorOut = await doorFor(outsider)

    const seenB = recorder()
    const seenOut = recorder()
    const stopB = await doorB.links.subscribe(projectId, seenB.onEvent)
    await doorOut.links.subscribe(projectId, seenOut.onEvent).catch(() => undefined)

    const link = await doorA.links.add(projectId, nodeId, 'Live', 'https://example.com/live')
    await seenB.next((e) => e.action === 'create' && e.record.id === link.id)
    await doorA.links.remove(link.id)
    await seenB.next((e) => e.action === 'delete' && e.record.id === link.id)
    await stopB()
    expect(seenOut.events).toEqual([])

    const addresses = [
      'https://example.com/a',
      'HTTP://EXAMPLE.COM',
      'http://localhost:8090/x',
      'https://a.example?x=1#y',
      'javascript:alert(1)',
      'data:text/html,x',
      'ftp://a.b',
      '//evil.example',
      'https://a b',
      'https://google.com@evil.example',
      'example.com',
      'https://',
    ]
    for (const address of addresses) {
      const accepted = await doorA.links.add(projectId, nodeId, '', address).then(
        () => true,
        () => false,
      )
      expect(accepted, address).toBe(checkLinkUrl(address).ok)
    }
  })
})
