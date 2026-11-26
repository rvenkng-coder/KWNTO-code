import { describe, expect, test } from 'vitest'
import { menuPosition } from './menuPosition'

const viewport = { width: 1280, height: 720 }
const menu = { width: 160, height: 120 }

describe('menuPosition', () => {
  // Protects: a menu with room below opens right under its button, left edges aligned.
  test('places the menu below the anchor when it fits', () => {
    expect(menuPosition({ left: 100, top: 20, width: 20, height: 20 }, menu, viewport)).toEqual({ left: 100, top: 40 })
  })

  // Protects: a menu opened near the right edge of the window is pulled back inside it (Review Focus 1).
  test('keeps the menu inside the right edge', () => {
    expect(menuPosition({ left: 1250, top: 20, width: 20, height: 20 }, menu, viewport)).toEqual({
      left: 1112,
      top: 40,
    })
  })

  // Protects: a menu with no room below flips above its button instead of leaving the window (Review Focus 1).
  test('opens above the anchor when there is no room below', () => {
    expect(menuPosition({ left: 100, top: 680, width: 20, height: 20 }, menu, viewport)).toEqual({
      left: 100,
      top: 560,
    })
  })

  // Protects: in a window smaller than the menu, the menu's top-left corner still stays on screen.
  test('never leaves the window when the window is smaller than the menu', () => {
    expect(menuPosition({ left: 10, top: 10, width: 20, height: 20 }, menu, { width: 100, height: 100 })).toEqual({
      left: 8,
      top: 8,
    })
  })
})
