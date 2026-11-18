import { backend } from '../../backend'
import { applyTheme, useTheme } from './theme'

/** Applies the other theme at once, then saves it to the account. */
export function ThemeToggle() {
  const theme = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className="btn"
      onClick={() => {
        applyTheme(next)
        // The screen has already changed; a failed save only means another device
        // keeps the old choice, so it is not worth an error on screen.
        void backend.preferences.set({ theme: next }).catch(() => undefined)
      }}
    >
      Switch to {next} theme
    </button>
  )
}
