import { useSyncExternalStore } from 'react'

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

/** The theme now in effect; re-renders when `applyTheme` changes it. */
export function useTheme(): Theme {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => current,
  )
}
