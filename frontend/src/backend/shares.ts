import type PocketBase from 'pocketbase'
import type { RecordModel } from 'pocketbase'
import { toBackendError } from './errors'
import type { Grant, ShareKind, ShareLink, SharePermission, ShareOpen } from './share-types'

function toLink(row: RecordModel): ShareLink {
  return {
    id: row.id,
    projectId: String(row.project),
    token: String(row.token),
    permission: row.permission as SharePermission,
    kind: row.kind as ShareKind,
    revoked: row.revoked === true,
    created: String(row.created),
  }
}

// Links that still work first, then the revoked ones; each group newest first.
function byUsefulness(a: ShareLink, b: ShareLink): number {
  return Number(a.revoked) - Number(b.revoked) || b.created.localeCompare(a.created)
}

function mediaUrl(baseUrl: string, token: string, mediaId: string, thumb: boolean): string {
  const base = `${baseUrl.replace(/\/$/, '')}/api/kwnto/share/${encodeURIComponent(token)}/media/${encodeURIComponent(mediaId)}`
  return thumb ? `${base}?thumb=100x100` : base
}

async function fetchMedia(pb: PocketBase, url: string): Promise<Blob> {
  const response = await fetch(url, { headers: { Authorization: pb.authStore.token } })
  if (!response.ok) throw toBackendError(new Error('Media removed'))
  return response.blob()
}

async function editGrants(pb: PocketBase): Promise<Grant[]> {
  const rows = await pb.collection('link_grants').getFullList({ filter: "permission = 'edit'", sort: '-created' })
  // Two edit links of one project make two rows (newest first); the person sees the project once.
  const seen = new Set<string>()
  return rows
    .filter((row) => !seen.has(String(row.project)) && seen.add(String(row.project)))
    .map((row) => ({
      projectId: String(row.project),
      projectName: String(row.project_name),
      permission: row.permission as SharePermission,
    }))
}

/** Share links (design 5): members make and revoke them; anyone opens one through the server's routes. */
export function createShares(pb: PocketBase) {
  async function wrapped<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      throw toBackendError(err)
    }
  }
  const route = (token: string): string => `/api/kwnto/share/${encodeURIComponent(token)}`

  return {
    async list(projectId: string): Promise<ShareLink[]> {
      return wrapped(async () => {
        const rows = await pb
          .collection('share_links')
          .getFullList({ filter: pb.filter('project = {:p}', { p: projectId }) })
        return rows.map(toLink).sort(byUsefulness)
      })
    },

    async create(projectId: string, permission: SharePermission, kind: ShareKind): Promise<ShareLink> {
      return wrapped(async () => {
        const created_by = pb.authStore.record?.id
        return toLink(await pb.collection('share_links').create({ project: projectId, created_by, permission, kind }))
      })
    },

    /** A revoked link cannot come back; a member makes a new one. */
    async revoke(id: string): Promise<void> {
      await wrapped(() => pb.collection('share_links').update(id, { revoked: true }))
    },

    async republish(id: string): Promise<ShareLink> {
      return wrapped(async () => {
        await pb.send(`/api/kwnto/share-links/${encodeURIComponent(id)}/republish`, { method: 'POST' })
        return toLink(await pb.collection('share_links').getOne(id))
      })
    },

    /** 401 and 403 are `forbidden` with the server's sentence; a bad link is `not-found`. */
    async open(token: string): Promise<ShareOpen> {
      return wrapped(() => pb.send<ShareOpen>(route(token), { method: 'GET' }))
    },

    async join(token: string): Promise<{ projectId: string; permission: SharePermission }> {
      return wrapped(() => pb.send(`${route(token)}/join`, { method: 'POST' }))
    },

    /** Works in `<img>` and `<audio>` for view links; a comment link needs `mediaBlob` (the browser cannot add a header). */
    mediaUrl: (token: string, mediaId: string, thumb = false): string => mediaUrl(pb.baseURL, token, mediaId, thumb),

    /** The media of a comment link, fetched with the caller's token. */
    mediaBlob: (token: string, mediaId: string): Promise<Blob> =>
      wrapped(() => fetchMedia(pb, mediaUrl(pb.baseURL, token, mediaId, false))),

    /** Edit grants only: comment links are reopened through the link itself. */
    myGrants: (): Promise<Grant[]> => wrapped(() => editGrants(pb)),
  }
}
