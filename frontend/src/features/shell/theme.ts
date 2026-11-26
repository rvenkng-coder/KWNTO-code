import { createContext, useContext, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

let current: Theme = 'dark'
const listeners = new Set<() => void>()

/** Sets the theme on <html>; the CSS tokens in index.css do the rest. */
export function applyTheme(theme: Theme): void {
  current = theme
  document.documentElement.dataset.theme = theme
  listeners.forEach((l) => l())
}

/** The theme the browser asks for, used while nobody is signed in. */
export function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Makes `useTheme()` answer this theme inside a subtree (the export stage is always light, because exports are printed
 * and shared).
 */
export const ThemeOverride = createContext<Theme | null>(null)

/** The theme now in effect (the override of the nearest `ThemeOverride`, if any); re-renders when `applyTheme` changes it. */
export function useTheme(): Theme {
  const override = useContext(ThemeOverride)
  const current = useAccountTheme()
  return override ?? current
}

function useAccountTheme(): Theme {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => current,
    () => current,
  )
}
