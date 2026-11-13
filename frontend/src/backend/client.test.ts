// Protects design 6.7: an unreachable backend is a normal state the UI reports, never a crash.
import { expect, test } from 'vitest'
import { createBackend } from './client'

test('health() resolves false when the backend is unreachable', async () => {
  await expect(createBackend('http://127.0.0.1:1').health()).resolves.toBe(false)
})
