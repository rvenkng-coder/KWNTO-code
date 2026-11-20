import { Buffer } from 'node:buffer'
import { adminPB } from './admin.ts'

export const PNG_1PX: Buffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==',
  'base64',
)

export function sampleBytes(
  type: 'wav' | 'mp3' | 'mov' | 'mp4' | 'jpeg' | 'png' | 'html' | 'zeros',
  size: number,
): Buffer {
  const out = Buffer.alloc(size)
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

export async function setQuotaOverride(email: string, bytes: number): Promise<void> {
  const pb = await adminPB()
  const user = await pb.collection('users').getFirstListItem(pb.filter('email = {:email}', { email: email.toLowerCase() }))
  const row = await pb.collection('user_limits').getFirstListItem(pb.filter('user = {:user}', { user: user.id }))
  await pb.collection('user_limits').update(row.id, { quota_override_bytes: bytes })
}
