import { backend } from '../../backend'
import { applyTheme, useTheme } from './theme'

/** A light/dark slider: applies the other theme at once, then saves it to the account. */
export function ThemeToggle() {
  const theme = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark theme"
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="flex items-center gap-1 text-sm text-muted"
      onClick={() => {
        const next = dark ? 'light' : 'dark'
        applyTheme(next)
        // The screen has already changed; a failed save only means another device
        // keeps the old choice, so it is not worth an error on screen.
        void backend.preferences.set({ theme: next }).catch(() => undefined)
      }}
    >
      <span aria-hidden="true">☀</span>
      <span aria-hidden="true" className={`relative inline-block h-5 w-9 rounded-full border border-border ${dark ? 'bg-accent' : 'bg-bg'}`}>
        <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-text transition-all ${dark ? 'left-[1.1rem]' : 'left-0.5'}`} />
      </span>
      <span aria-hidden="true">☾</span>
    </button>
  )
}
