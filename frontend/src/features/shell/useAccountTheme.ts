import { useEffect } from 'react'
import { backend } from '../../backend'
import { applyTheme, systemTheme } from './theme'

/**
 * Signed in: the theme saved to the account. Signed out: the browser's
 * `prefers-color-scheme`, kept up to date while the page is open.
 */
export function useAccountTheme(signedIn: boolean): void {
  useEffect(() => {
    if (signedIn) {
      let cancelled = false
      backend.preferences
        .get()
        .then((p) => { if (!cancelled) applyTheme(p.theme) })
        .catch(() => { if (!cancelled) applyTheme(systemTheme()) })
      return () => { cancelled = true }
    }
    applyTheme(systemTheme())
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(systemTheme())
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [signedIn])
}
