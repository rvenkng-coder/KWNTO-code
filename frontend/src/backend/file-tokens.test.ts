import { describe, expect, test, vi } from 'vitest'
import { createFileTokens } from './file-tokens.ts'

describe('file token reuse', () => {
  // Protects: a file token is reused for ninety seconds (C2)
  test('a file token is reused for ninety seconds', async () => {
    let nowMs = 100_000
    let fetchCount = 0
    let failFetch = false

    const fetchToken = vi.fn(async () => {
      fetchCount++
      if (failFetch) {
        throw new Error('network down')
      }
      return `token-${fetchCount}`
    })

    const tokenCache = createFileTokens(fetchToken, () => nowMs)

    // Parallel get calls share one fetch
    const [tokA, tokB] = await Promise.all([tokenCache.get(), tokenCache.get()])
    expect(tokA).toBe('token-1')
    expect(tokB).toBe('token-1')
    expect(fetchCount).toBe(1)

    // get twice within 89 s (token reused)
    nowMs += 89_000
    expect(await tokenCache.get()).toBe('token-1')
    expect(fetchCount).toBe(1)

    // once more at 91 s (token renewed)
    nowMs += 2_000 // total +91s
    expect(await tokenCache.get()).toBe('token-2')
    expect(fetchCount).toBe(2)

    // A fetch that fails, then get again
    failFetch = true
    nowMs += 95_000
    await expect(tokenCache.get()).rejects.toThrow('network down')
    expect(fetchCount).toBe(3)

    failFetch = false
    expect(await tokenCache.get()).toBe('token-4')
    expect(fetchCount).toBe(4)
  })
})
