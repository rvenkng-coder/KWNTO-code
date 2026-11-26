// Where a chapter menu goes on screen. Menus are drawn in a fixed layer above the canvas, so
// their place is computed from the button that opened them rather than left to CSS.

export interface Box {
  left: number
  top: number
  width: number
  height: number
}
export interface Size {
  width: number
  height: number
}

/** The smallest gap kept between a menu and the window's edges. */
export const MENU_MARGIN = 8

/** Below the anchor, left edges aligned; above it when there is no room below; always inside the window. */
export function menuPosition(anchor: Box, menu: Size, viewport: Size): { left: number; top: number } {
  const below = anchor.top + anchor.height
  const fitsBelow = below + menu.height + MENU_MARGIN <= viewport.height
  const top = fitsBelow ? below : anchor.top - menu.height
  return {
    left: clamp(anchor.left, viewport.width - menu.width - MENU_MARGIN),
    top: clamp(top, viewport.height - menu.height - MENU_MARGIN),
  }
}

function clamp(value: number, max: number): number {
  return Math.max(MENU_MARGIN, Math.min(value, max))
}
