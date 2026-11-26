import { PB_URL, asAdmin, asUser, rawSend, type TestUser } from './pb.ts'
import { send, tokenOf, type Reply } from './invites.ts'

// Helpers for the share link tests (plan 2026-11-20-sharing Task 3).

// A link made through the member's own session (the create rule and the create hook apply).
export async function createLink(
  user: TestUser,
  projectId: string,
  permission: 'view' | 'comment' | 'edit',
  kind: 'live' | 'snapshot',
): Promise<{ id: string; token: string }> {
  const pb = await asUser(user)
  const made = await pb.collection('share_links').create({ project: projectId, created_by: user.id, permission, kind })
  const stored = await (await asAdmin()).collection('share_links').getOne(made.id)
  return { id: made.id, token: String(stored.token) }
}

// Revokes a link through the member's own session.
export async function revokeLink(user: TestUser, linkId: string): Promise<void> {
  await (await asUser(user)).collection('share_links').update(linkId, { revoked: true })
}

async function tokenFor(user: TestUser | undefined): Promise<string | undefined> {
  return user === undefined ? undefined : tokenOf(user)
}

// GET /api/kwnto/share/{token}
export async function openShare(token: string, user?: TestUser): Promise<Reply> {
  return send(await tokenFor(user), `/api/kwnto/share/${encodeURIComponent(token)}`, {})
}

// POST /api/kwnto/share/{token}/join
export async function joinShare(token: string, user: TestUser): Promise<Reply> {
  return send(await tokenOf(user), `/api/kwnto/share/${encodeURIComponent(token)}/join`, { method: 'POST' })
}

// GET /api/kwnto/share/{token}/media/{mediaId}
export async function shareMedia(token: string, mediaId: string, user?: TestUser): Promise<Response> {
  return rawSend(
    await tokenFor(user),
    `/api/kwnto/share/${encodeURIComponent(token)}/media/${encodeURIComponent(mediaId)}`,
  )
}

export { PB_URL }
