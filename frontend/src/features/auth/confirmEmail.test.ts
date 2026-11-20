import { describe, expect, test, vi } from 'vitest'
import { confirmEmail } from './confirmEmail'

// Protects the verification screen: the outcome follows the confirm call; a failing session refresh never turns success into "expired".
function fakeAuth(over: Partial<Parameters<typeof confirmEmail>[0]> = {}) {
  return {
    confirmVerification: vi.fn().mockResolvedValue(undefined),
    current: vi.fn().mockReturnValue({ id: 'u1' }),
    refresh: vi.fn().mockResolvedValue(undefined),
    ...over,
  }
}

describe('confirmEmail', () => {
  test('done after a confirm and a refresh', async () => {
    const auth = fakeAuth()
    expect(await confirmEmail(auth, 'tok')).toBe('done')
    expect(auth.confirmVerification).toHaveBeenCalledWith('tok')
    expect(auth.refresh).toHaveBeenCalledOnce()
  })

  test('failed when the confirm is refused, and no refresh is tried', async () => {
    const auth = fakeAuth({ confirmVerification: vi.fn().mockRejectedValue(new Error('bad token')) })
    expect(await confirmEmail(auth, 'tok')).toBe('failed')
    expect(auth.refresh).not.toHaveBeenCalled()
  })

  test('still done when the confirm worked but the refresh throws', async () => {
    const auth = fakeAuth({ refresh: vi.fn().mockRejectedValue(new Error('offline')) })
    expect(await confirmEmail(auth, 'tok')).toBe('done')
  })

  test('done without a refresh when nobody is signed in', async () => {
    const auth = fakeAuth({ current: vi.fn().mockReturnValue(null) })
    expect(await confirmEmail(auth, 'tok')).toBe('done')
    expect(auth.refresh).not.toHaveBeenCalled()
  })
})
