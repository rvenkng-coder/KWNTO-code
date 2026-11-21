import { expect, test } from 'vitest'
import { memberProject } from './helpers/content.ts'
import { tokenOf } from './helpers/invites.ts'
import { PB_URL } from './helpers/pb.ts'

// Protects review finding M2 of plan 2026-11-20-sharing: one import can hold the database's only
// write connection for seconds, so a person may start 10 an hour; the 11th gets 429 with a
// message and creates nothing, and another person is not affected. Route:
// backend/pb_hooks/project-file.pb.js, limit: backend/pb_hooks/lib/import-limit.js.

const SMALL_FILE = JSON.stringify({
  format: 'kwnto-project',
  version: 1,
  exportedAt: 'now',
  project: { name: 'Tiny', startNode: null },
  chapters: [],
  nodes: [],
  lines: [],
  cues: [],
  connections: [],
  media: [],
})

function post(token: string, teamId: string): Promise<Response> {
  return fetch(`${PB_URL}/api/kwnto/teams/${teamId}/import`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: SMALL_FILE,
  })
}

// Protects: M2, the limit of 10 imports an hour per person (429 on the 11th, nothing made, others unaffected).
test('the eleventh import in an hour is refused with 429', { timeout: 120_000 }, async () => {
  const ctx = await memberProject()
  const token = await tokenOf(ctx.member)
  for (let i = 0; i < 10; i++) expect((await post(token, ctx.teamId)).status).toBe(200)

  const refused = await post(token, ctx.teamId)
  expect(refused.status).toBe(429)
  expect(await refused.json()).toMatchObject({ message: 'Too many imports. Try again later.' })

  expect((await post(await tokenOf(ctx.owner), ctx.teamId)).status).toBe(200)
})
