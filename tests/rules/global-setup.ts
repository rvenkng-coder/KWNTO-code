export default async function globalSetup() {
  const pbUrl = process.env.KWNTO_PB_URL ?? 'http://127.0.0.1:8091'
  const start = Date.now()
  const timeoutMs = 30_000

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${pbUrl}/api/health`)
      if (res.ok) {
        return
      }
    } catch {
      // not reachable yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`PocketBase is not reachable at ${pbUrl}. Use "npm run test:rules", which starts it.`)
}
