/** The three calls the verify screen needs from `backend.auth`; a parameter so the logic is testable without a backend. */
export interface VerifyAuth {
  confirmVerification: (token: string) => Promise<unknown>
  current: () => unknown
  refresh: () => Promise<unknown>
}

/**
 * Confirms the token, then refreshes the stored session. Only the confirm decides the outcome: once the token is
 * accepted the email IS verified, so a failing refresh (network drop) must not show "not valid or expired".
 */
export async function confirmEmail(auth: VerifyAuth, token: string): Promise<'done' | 'failed'> {
  try {
    await auth.confirmVerification(token)
  } catch {
    return 'failed'
  }
  try {
    // Signed in: the stored session still says "not verified"; fetch the new flag so the gate lifts.
    if (auth.current()) await auth.refresh()
  } catch {
    // The email is verified; the next sign-in or reload picks up the flag.
  }
  return 'done'
}
