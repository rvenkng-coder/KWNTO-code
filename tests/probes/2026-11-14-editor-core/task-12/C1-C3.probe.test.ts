import { expect, test } from 'vitest'
import { shortcutFor, type KeyInput } from '../../../../frontend/src/features/editor/model/shortcuts'

const key = (k: string, mods: Partial<Omit<KeyInput, 'key'>> = {}): KeyInput =>
  ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods })

// Protects: letters are compared lower-cased, so Caps Lock or Shift does not change the action.
test('[C1] case-and-whitespace: upper-case keys map like lower-case ones', () => {
  expect(shortcutFor(key('Z', { ctrlKey: true }), false)).toBe('undo')
  expect(shortcutFor(key('Z', { metaKey: true, shiftKey: true }), false)).toBe('redo')
  expect(shortcutFor(key('Y', { ctrlKey: true }), false)).toBe('redo')
  expect(shortcutFor(key('K', { metaKey: true }), false)).toBe('search')
  expect(shortcutFor(key('A', { metaKey: true }), false)).toBe('selectAll')
  expect(shortcutFor(key('C', { metaKey: true }), false)).toBe('copy')
})

// Protects: Meta works for every Ctrl shortcut (Mac), not only the stated ones.
test('[C1] relative-of-fixed-case: Meta and Ctrl are the same modifier', () => {
  for (const k of ['z', 'y', 'c', 'v', 'k', 'a']) {
    expect(shortcutFor(key(k, { metaKey: true }), false)).toBe(shortcutFor(key(k, { ctrlKey: true }), false))
  }
})

// Protects: inside a text field Meta+K is search too, and every other shortcut stays with the browser.
test('[C2] relative-of-fixed-case: text field with Meta and with Shift', () => {
  expect(shortcutFor(key('k', { metaKey: true }), true)).toBe('search')
  expect(shortcutFor(key('K', { ctrlKey: true }), true)).toBe('search')
  expect(shortcutFor(key('z', { metaKey: true, shiftKey: true }), true)).toBeNull()
  expect(shortcutFor(key('a', { metaKey: true }), true)).toBeNull()
  expect(shortcutFor(key('Backspace'), true)).toBeNull()
})

// Protects: Alt held means no shortcut, even for search and inside a text field.
test('[C3] second-bad-item: Alt with every shortcut key', () => {
  for (const k of ['z', 'y', 'c', 'v', 'k', 'a']) {
    expect(shortcutFor(key(k, { ctrlKey: true, altKey: true }), false)).toBeNull()
    expect(shortcutFor(key(k, { metaKey: true, altKey: true }), true)).toBeNull()
  }
  expect(shortcutFor(key('Delete', { altKey: true }), false)).toBeNull()
})

// Protects: Delete and Backspace are a shortcut only with no modifier at all.
test('[C3] relative-of-fixed-case: Delete and Backspace with a modifier', () => {
  expect(shortcutFor(key('Delete', { shiftKey: true }), false)).toBeNull()
  expect(shortcutFor(key('Backspace', { metaKey: true }), false)).toBeNull()
  expect(shortcutFor(key('Backspace', { ctrlKey: true }), false)).toBeNull()
  expect(shortcutFor(key('Control', { ctrlKey: true }), false)).toBeNull()
  expect(shortcutFor(key('k'), false)).toBeNull()
})
