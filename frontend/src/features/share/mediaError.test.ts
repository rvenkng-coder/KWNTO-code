import { describe, expect, it } from 'vitest'
import { failedToLoad } from './mediaError'

describe('failedToLoad', () => {
  // Protects: a computer with no audio device does not report a good file as removed.
  it('is false for a decode error on a loaded file', () => {
    for (const readyState of [1, 2, 3, 4]) expect(failedToLoad({ error: { code: 3 }, readyState })).toBe(false)
  })

  // Protects: a file the browser cannot decode at all still shows Media removed.
  it('is true for a decode error before anything loaded', () => {
    expect(failedToLoad({ error: { code: 3 }, readyState: 0 })).toBe(true)
  })

  // Protects: a file deleted for good, or cut off while playing, still shows Media removed.
  it('is true for the other errors, loaded or not', () => {
    for (const code of [1, 2, 4]) {
      expect(failedToLoad({ error: { code }, readyState: 0 })).toBe(true)
      expect(failedToLoad({ error: { code }, readyState: 4 })).toBe(true)
    }
  })

  // Protects: an error event that gives no reason counts as a failed load.
  it('is true when the element gives no error', () => {
    expect(failedToLoad({ error: null, readyState: 4 })).toBe(true)
  })
})
