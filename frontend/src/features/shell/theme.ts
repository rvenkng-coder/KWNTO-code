export type Theme = 'light' | 'dark'

/** Sets the theme on <html>; the CSS tokens in index.css do the rest. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

/** The theme the browser asks for, used while nobody is signed in. */
export function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
