import { expect, test } from 'vitest'
import { shortcutFor } from './shortcuts'

// Protects: every shortcut key maps to its correct action without ambiguity.
test('each shortcut maps to its action', () => {
  const no = { key: 'x', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }
  expect(shortcutFor({ ...no, key: 'z' }, false)).toBeNull()
  expect(shortcutFor({ ...no, key: 'Z' }, false)).toBeNull()
  expect(shortcutFor({ ...no, key: 'z', ctrlKey: true }, false)).toBe('undo')
  expect(shortcutFor({ ...no, key: 'z', metaKey: true }, false)).toBe('undo')
  expect(shortcutFor({ ...no, key: 'z', ctrlKey: true, shiftKey: true }, false)).toBe('redo')
  expect(shortcutFor({ ...no, key: 'Z', metaKey: true, shiftKey: true }, false)).toBe('redo')
  expect(shortcutFor({ ...no, key: 'y', ctrlKey: true }, false)).toBe('redo')
  expect(shortcutFor({ ...no, key: 'Y', metaKey: true }, false)).toBe('redo')
  expect(shortcutFor({ ...no, key: 'c', ctrlKey: true }, false)).toBe('copy')
  expect(shortcutFor({ ...no, key: 'C', metaKey: true }, false)).toBe('copy')
  expect(shortcutFor({ ...no, key: 'v', metaKey: true }, false)).toBe('paste')
  expect(shortcutFor({ ...no, key: 'V', ctrlKey: true }, false)).toBe('paste')
  expect(shortcutFor({ ...no, key: 'k', ctrlKey: true }, false)).toBe('search')
  expect(shortcutFor({ ...no, key: 'K', metaKey: true }, false)).toBe('search')
  expect(shortcutFor({ ...no, key: 'a', ctrlKey: true }, false)).toBe('selectAll')
  expect(shortcutFor({ ...no, key: 'A', metaKey: true }, false)).toBe('selectAll')
  expect(shortcutFor({ ...no, key: 'Delete' }, false)).toBe('delete')
  expect(shortcutFor({ ...no, key: 'Backspace' }, false)).toBe('delete')
})

// Protects: inside a text field only search survives; everything else is suppressed.
test('inside a text field only search is taken', () => {
  const no = { key: 'x', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }
  expect(shortcutFor({ ...no, key: 'z' }, true)).toBeNull()
  expect(shortcutFor({ ...no, key: 'z', ctrlKey: true }, true)).toBeNull()
  expect(shortcutFor({ ...no, key: 'z', metaKey: true }, true)).toBeNull()
  expect(shortcutFor({ ...no, key: 'z', ctrlKey: true, shiftKey: true }, true)).toBeNull()
  expect(shortcutFor({ ...no, key: 'y', ctrlKey: true }, true)).toBeNull()
  expect(shortcutFor({ ...no, key: 'c', ctrlKey: true }, true)).toBeNull()
  expect(shortcutFor({ ...no, key: 'v', metaKey: true }, true)).toBeNull()
  expect(shortcutFor({ ...no, key: 'k', ctrlKey: true }, true)).toBe('search')
  expect(shortcutFor({ ...no, key: 'a', ctrlKey: true }, true)).toBeNull()
  expect(shortcutFor({ ...no, key: 'Delete' }, true)).toBeNull()
  expect(shortcutFor({ ...no, key: 'Backspace' }, true)).toBeNull()
})

// Protects: keys that look close to shortcuts but aren't return null; Alt cancels everything.
test('other keys are not shortcuts', () => {
  const no = { key: 'x', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }
  expect(shortcutFor({ ...no, key: 'z' }, false)).toBeNull()
  expect(shortcutFor({ ...no, key: 'z', ctrlKey: true, altKey: true }, false)).toBeNull()
  expect(shortcutFor({ ...no, key: 'Delete', ctrlKey: true, shiftKey: true }, false)).toBeNull()
  expect(shortcutFor({ ...no, key: 'q', ctrlKey: true }, false)).toBeNull()
})
