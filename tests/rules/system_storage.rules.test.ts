import { expect, test } from 'vitest'
import { adminOnlyTests, readOnlyRecord, singleRecordTest } from './helpers/admin-only.ts'

// Protects design 7c and docs/security.md section 2: system settings are admin only,
// there is exactly one record, and its defaults are the ones the spec names.
adminOnlyTests('system_storage', { default_quota_bytes: 1 })
singleRecordTest('system_storage')

// Defaults from design 7c and security.md section 4: 2 GB per user, 200 MB video,
// 50 MB audio and images. Video (mov, mp4) is off by decision, because large uploads
// did not finish through Funnel, so only four file types are allowed.
test('system_storage starts with the spec defaults', async () => {
  const record = await readOnlyRecord('system_storage')
  expect(record.default_quota_bytes).toBe(2147483648)
  expect(record.max_video_mb).toBe(200)
  expect(record.max_audio_mb).toBe(50)
  expect(record.max_image_mb).toBe(50)
  expect(record.allowed_types).toEqual(['wav', 'mp3', 'ogg', 'm4a', 'opus', 'jpeg', 'png'])
})
