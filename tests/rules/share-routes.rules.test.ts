import { afterEach, expect, test } from 'vitest'
import { createNode, guardedUpdate, memberProject, readAsAdmin, type MemberProject } from './helpers/content.ts'
import { send, setVerified, tokenOf, unverifiedUser } from './helpers/invites.ts'
import { deleteAllMedia, PNG_1PX, uploadMedia } from './helpers/media.ts'
import { adminSend, asAdmin, asUser, createUser, rawSend, type TestUser } from './helpers/pb.ts'
import { createLink, joinShare, openShare, revokeLink, shareMedia } from './helpers/share.ts'
import { addMember } from './helpers/teams.ts'

// Media made here must not outlive the file: other rule files count the whole table.
afterEach(deleteAllMedia)

// The share routes of backend/pb_hooks/share.pb.js (design 5; plan 2026-11-20-sharing Task 3,
// D2, D8 and D10): the view of a project through a token, media through a token, joining a
// comment or edit link, republishing a snapshot and the admin's revoke-all. Every link
// level is tried signed out, unverified and verified; a bad token gets one and the same 404.

const BAD_LINK = 'This link is not valid or was revoked.'
const SIGN_IN = 'Sign in to open this shared project.'
const VERIFY = 'Verify your email to open this shared project.'
const CSP = "default-src 'none'; img-src 'self'; media-src 'self'; sandbox"

type Shared = { file: { nodes: { title: string }[] }; permission: string; kind: string; projectId: string; projectName: string }

async function titlesOf(token: string): Promise<string[]> {
  const reply = await openShare(token)
  expect(reply.status).toBe(200)
  return (reply.body as unknown as Shared).file.nodes.map((node) => node.title).sort()
}

async function trashProject(ctx: MemberProject): Promise<void> {
  const version = Number((await readAsAdmin('projects', ctx.projectId)).version)
  expect((await guardedUpdate(ctx.owner, 'projects', ctx.projectId, { deleted_at: '2026-11-20 10:00:00.000Z', version })).status).toBe(200)
}

async function grantsOn(linkId: string): Promise<number> {
  const admin = await asAdmin()
  return (await admin.collection('link_grants').getFullList({ filter: admin.filter('link = {:l}', { l: linkId }) })).length
}

// What a caller can see of a refusal: status, the type of the body and the body itself.
async function refusal(token: string): Promise<[number, string | null, string]> {
  const response = await rawSend(undefined, `/api/kwnto/share/${encodeURIComponent(token)}`)
  return [response.status, response.headers.get('content-type'), await response.text()]
}

// Protects Review Focus 1: a view link shows a live project as it is now, a snapshot as it
// was until it is republished; an unknown, injected, revoked or trashed-project link is one
// and the same 404, so nobody can tell which tokens exist.
test('a view link shows the project to anyone until it is revoked', async () => {
  const ctx = await memberProject()
  const { member, projectId, chapterId } = ctx
  await createNode(member, projectId, chapterId, { title: 'first' })
  const live = await createLink(member, projectId, 'view', 'live')
  const snap = await createLink(member, projectId, 'view', 'snapshot')

  const opened = (await openShare(live.token)).body as unknown as Shared
  expect(opened).toMatchObject({ permission: 'view', kind: 'live', projectId })
  expect(await titlesOf(live.token)).toEqual(['first'])
  await createNode(member, projectId, chapterId, { title: 'second' })
  expect(await titlesOf(live.token)).toEqual(['first', 'second'])
  expect(await titlesOf(snap.token)).toEqual(['first'])

  const republish = await send(await tokenOf(member), `/api/kwnto/share-links/${snap.id}/republish`, { method: 'POST' })
  expect(republish.status).toBe(200)
  expect(await titlesOf(snap.token)).toEqual(['first', 'second'])

  const gone = await createLink(member, projectId, 'view', 'live')
  await revokeLink(member, gone.id)
  const trashed = await memberProject()
  const trashedLink = await createLink(trashed.member, trashed.projectId, 'view', 'live')
  await trashProject(trashed)
  const refusals = [gone.token, "' OR 1=1 --", '%', 'x'.repeat(40), trashedLink.token]
  const first = await refusal(refusals[0])
  expect(first[0]).toBe(404)
  expect(JSON.parse(first[2]).message).toBe(BAD_LINK)
  for (const token of refusals) expect(await refusal(token)).toEqual(first)
})

// Protects D8 and Review Focus 1: media goes through the link's own project only, stops
// with the link, never serves removed or foreign media, and a snapshot lists its own.
test('link holders get the project\'s media and nothing else', async () => {
  const { member, projectId, chapterId } = await memberProject()
  const nodeId = await createNode(member, projectId, chapterId)
  const pic = async (user: TestUser, project: string, node: string) =>
    ((await (await uploadMedia(user, { project, node }, { name: 'pic.png', bytes: PNG_1PX })).json()) as { id: string }).id
  const mediaId = await pic(member, projectId, nodeId)
  const removedId = await pic(member, projectId, nodeId)
  const other = await memberProject()
  const foreignId = await pic(other.owner, other.projectId, await createNode(other.owner, other.projectId, other.chapterId))
  const live = await createLink(member, projectId, 'view', 'live')
  const snap = await createLink(member, projectId, 'view', 'snapshot')

  const served = await shareMedia(live.token, mediaId)
  expect(served.status).toBe(200)
  expect((await served.arrayBuffer()).byteLength).toBe(PNG_1PX.length)
  expect(served.headers.get('x-content-type-options')).toBe('nosniff')
  expect(served.headers.get('content-security-policy')).toBe(CSP)
  const thumb = await rawSend(undefined, `/api/kwnto/share/${live.token}/media/${mediaId}?thumb=100x100`)
  expect(thumb.status).toBe(200)

  const admin = await asAdmin()
  await admin.collection('media').update(removedId, { removed_at: '2026-11-20 10:00:00.000Z' })
  expect((await shareMedia(live.token, removedId)).status).toBe(404)
  expect((await shareMedia(live.token, foreignId)).status).toBe(404)
  expect((await shareMedia(snap.token, mediaId)).status).toBe(200)
  expect((await shareMedia(snap.token, removedId)).status).toBe(404)

  await revokeLink(member, live.id)
  expect((await shareMedia(live.token, mediaId)).status).toBe(404)
  await admin.collection('media').delete(mediaId)
  expect((await shareMedia(snap.token, mediaId)).status).toBe(404)
})

// Protects security.md 3 and D2: comment and edit links need a verified sign-in (with the
// exact copy), an edit link answers only with the project id, joining twice makes one
// grant, a view link cannot be joined, a team member needs no grant, a live link has no
// snapshot to republish.
test('comment and edit links need a verified sign-in and make one grant', async () => {
  const ctx = await memberProject()
  const { member, projectId } = ctx
  const holder = await createUser()
  const unverified = await unverifiedUser()
  const comment = await createLink(member, projectId, 'comment', 'live')
  const edit = await createLink(member, projectId, 'edit', 'live')
  const view = await createLink(member, projectId, 'view', 'live')

  for (const link of [comment, edit]) {
    const signedOut = await openShare(link.token)
    expect([signedOut.status, signedOut.body?.message]).toEqual([401, SIGN_IN])
    const notVerified = await openShare(link.token, unverified)
    expect([notVerified.status, notVerified.body?.message]).toEqual([403, VERIFY])
  }
  const viewing = await openShare(comment.token, holder)
  expect(viewing.status).toBe(200)
  expect((viewing.body as unknown as Shared).file.nodes).toEqual([])

  const joined = await joinShare(comment.token, holder)
  expect([joined.status, joined.body]).toEqual([200, { projectId, permission: 'comment' }])
  expect((await joinShare(comment.token, holder)).status).toBe(200)
  expect(await grantsOn(comment.id)).toBe(1)
  expect((await joinShare(comment.token, unverified)).status).toBe(403)

  const editView = await openShare(edit.token, holder)
  expect([editView.status, editView.body]).toEqual([200, { permission: 'edit', projectId }])
  expect((await joinShare(edit.token, holder)).status).toBe(200)
  expect(await grantsOn(edit.id)).toBe(1)
  expect((await joinShare(view.token, holder)).status).toBe(404)

  const teammate = await createUser()
  await addMember(ctx.teamId, teammate)
  expect((await joinShare(edit.token, teammate)).status).toBe(200)
  expect(await grantsOn(edit.id)).toBe(1)

  const live = await send(await tokenOf(member), `/api/kwnto/share-links/${view.id}/republish`, { method: 'POST' })
  expect([live.status, live.body?.message]).toEqual([400, 'Only a snapshot can be republished.'])
  const stranger = await send(await tokenOf(holder), `/api/kwnto/share-links/${view.id}/republish`, { method: 'POST' })
  expect(stranger.status).toBe(404)
  await setVerified(unverified, true)
})

// Protects runbook control 6 (security.md 9): the admin revokes every link at once, a
// member cannot, and the action is logged with its count.
test('the admin revokes every link at once', async () => {
  const admin = await asAdmin()
  for (const row of await admin.collection('share_links').getFullList()) await admin.collection('share_links').delete(row.id)
  const [a, b] = [await memberProject(), await memberProject()]
  const links = [
    await createLink(a.member, a.projectId, 'view', 'live'),
    await createLink(a.member, a.projectId, 'edit', 'live'),
    await createLink(b.member, b.projectId, 'view', 'snapshot'),
  ]
  const path = '/api/kwnto/admin/share-links/revoke-all'
  const asMember = await rawSend(await tokenOf(a.member), path, { method: 'POST' })
  const signedOut = await rawSend(undefined, path, { method: 'POST' })
  expect([asMember.status, signedOut.status].every((status) => status === 401 || status === 403)).toBe(true)
  expect(await asUser(a.member).then((pb) => pb.collection('share_links').getFullList())).toHaveLength(2)

  const done = await adminSend(path, { method: 'POST' })
  expect([done.status, await done.json()]).toEqual([200, { count: 3 }])
  for (const link of links) expect((await admin.collection('share_links').getOne(link.id)).revoked).toBe(true)
  expect((await openShare(links[0].token)).status).toBe(404)
  const events = await admin.collection('security_events').getFullList({ filter: "type = 'admin'", sort: '-created' })
  expect(events.some((row) => (row.detail as { action?: string; count?: number }).action === 'revoke-all-links')).toBe(true)
})
