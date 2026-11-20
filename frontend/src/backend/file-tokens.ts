export const TOKEN_REUSE_MS = 90_000

export function createFileTokens(
  fetchToken: () => Promise<string>,
  now: () => number = () => Date.now(),
): { get(): Promise<string> } {
  let cached: { token: string; at: number } | null = null
  let inFlight: Promise<string> | null = null

  return {
    async get(): Promise<string> {
      if (cached !== null && now() - cached.at < TOKEN_REUSE_MS) return cached.token

      if (inFlight !== null) {
        return inFlight
      }

      inFlight = (async () => {
        try {
          const token = await fetchToken()
          cached = { token, at: now() }
          return token
        } finally {
          inFlight = null
        }
      })()

      return inFlight
    },
  }
}
