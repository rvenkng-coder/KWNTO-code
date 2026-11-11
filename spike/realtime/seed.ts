// THROWAWAY: seeds the spike backend (Task 3). Not imported by the app.
import PocketBase from 'pocketbase'

const ADMIN = { email: 'admin@example.test', password: 'spike-admin-password-1' }
export const USERS = [1, 2, 3].map((n) => ({ email: `spike${n}@example.test`, password: `spike-user-password-${n}` }))

export async function seed(url: string): Promise<{ users: { email: string; password: string }[] }> {
  const pb = new PocketBase(url)
  pb.autoCancellation(false)
  await pb.collection('_superusers').authWithPassword(ADMIN.email, ADMIN.password)

  // Batch requests are off by default; the seed uses them to stay fast.
  await pb.settings.update({ batch: { enabled: true, maxRequests: 100, timeout: 30, maxBodySize: 0 } })

  for (const u of USERS) {
    await pb.collection('users').create({ ...u, passwordConfirm: u.password, verified: true })
  }

  async function createNodes(project: string, count: number): Promise<string[]> {
    const ids: string[] = []
    for (let i = 0; i < count; i += 50) {
      const batch = pb.createBatch()
      for (let j = i; j < Math.min(i + 50, count); j++) {
        batch.collection('spike_nodes').create({ project, title: `Node ${j}`, color: '#888888', x: (j % 25) * 200, y: Math.floor(j / 25) * 150 })
      }
      const res = await batch.send()
      ids.push(...res.map((r) => (r.body as { id: string }).id))
    }
    return ids
  }

  const bigIds = await createNodes('big', 500)
  await createNodes('other', 10)

  const lines: { node: string; n: number }[] = bigIds.flatMap((node) => Array.from({ length: 10 }, (_, n) => ({ node, n })))
  for (let i = 0; i < lines.length; i += 50) {
    const batch = pb.createBatch()
    for (const { node, n } of lines.slice(i, i + 50)) {
      batch.collection('spike_lines').create({ project: 'big', node, text: `Line ${n}`, sort_order: n })
    }
    await batch.send()
  }

  console.log('seeded 510 nodes and 5000 lines')
  return { users: USERS }
}

if (import.meta.filename === process.argv[1]) {
  await seed(process.env.SPIKE_URL ?? 'http://127.0.0.1:8092')
}
