import { expect, test } from 'vitest'
import { isMacPlatform, shortcutLabel } from './shortcutLabel'

// Protects: editor cards design goal 3 (tooltips): on a Mac the Ctrl shortcuts read as ⌘, elsewhere as Ctrl+.
test('shortcut labels read Ctrl on Windows and Linux and ⌘ on a Mac', () => {
  expect(shortcutLabel('X', false)).toBe('Ctrl+X')
  expect(shortcutLabel('X', true)).toBe('⌘X')
  expect(isMacPlatform('MacIntel')).toBe(true)
  expect(isMacPlatform('Linux x86_64')).toBe(false)
})
