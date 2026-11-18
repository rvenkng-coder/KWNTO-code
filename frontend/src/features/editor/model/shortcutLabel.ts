// How a shortcut reads in a tooltip (editor cards design, goal 3): Ctrl+X, or ⌘X on a Mac.

export function shortcutLabel(key: string, isMac: boolean): string {
  return isMac ? `⌘${key}` : `Ctrl+${key}`
}

export function isMacPlatform(platform: string): boolean {
  return /Mac|iPhone|iPad/.test(platform)
}
