import { asAdmin, asUser, PB_URL, type TestUser } from './pb.ts'

export const PNG_1PX: Uint8Array = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==',
    'base64',
  ),
)

export function sampleBytes(
  type: 'wav' | 'mp3' | 'mov' | 'mp4' | 'jpeg' | 'png' | 'html' | 'zeros',
  size: number,
): Uint8Array {
  const out = new Uint8Array(size)
  let head: number[] = []
  if (type === 'png') {
    head = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  } else if (type === 'jpeg') {
    head = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]
  } else if (type === 'wav') {
    head = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]
  } else if (type === 'mp3') {
    head = [0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0]
  } else if (type === 'mov') {
    head = [0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20]
  } else if (type === 'mp4') {
    head = [0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]
  } else if (type === 'html') {
    head = Array.from(Buffer.from('<!doctype html>'))
  }
  for (let i = 0; i < Math.min(head.length, size); i++) {
    out[i] = head[i]
  }
  return out
}

export async function uploadMedia(
  user: TestUser | null,
  fields: { project: string; node: string; uploader?: string; [key: string]: unknown },
  file: { name: string; bytes: Uint8Array },
): Promise<Response> {
  const formData = new FormData()
  formData.append('project', fields.project)
  formData.append('node', fields.node)
  if (fields.uploader !== undefined) {
    formData.append('uploader', fields.uploader)
  } else if (user !== null) {
    formData.append('uploader', user.id)
  }
  for (const [key, value] of Object.entries(fields)) {
    if (key !== 'project' && key !== 'node' && key !== 'uploader') {
      formData.append(key, String(value))
    }
  }
  formData.append('file', new Blob([file.bytes]), file.name)

  const headers: Record<string, string> = {}
  if (user !== null) {
    const pb = await asUser(user)
    headers.Authorization = pb.authStore.token
  }

  return fetch(`${PB_URL}/api/collections/media/records`, {
    method: 'POST',
    headers,
    body: formData,
  })
}

export async function setQuotaOverride(userId: string, bytes: number): Promise<void> {
  const admin = await asAdmin()
  const row = await admin.collection('user_limits').getFirstListItem(admin.filter('user = {:user}', { user: userId }))
  await admin.collection('user_limits').update(row.id, { quota_override_bytes: bytes })
}

export async function setStorageSetting(field: string, value: unknown): Promise<() => Promise<void>> {
  const admin = await asAdmin()
  const record = await admin.collection('system_storage').getFirstListItem('')
  const previous = record[field]
  await admin.collection('system_storage').update(record.id, { [field]: value })
  return async () => {
    await admin.collection('system_storage').update(record.id, { [field]: previous })
  }
}

// Deletes every media record. Other rule files (video-off) count the whole table, so a file that
// uploads media cleans up after itself.
export async function deleteAllMedia(): Promise<void> {
  const admin = await asAdmin()
  for (const row of await admin.collection('media').getFullList()) await admin.collection('media').delete(row.id)
}

