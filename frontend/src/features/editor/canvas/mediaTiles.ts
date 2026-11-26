/** How many tiles of `tile` pixels, `gap` apart, fit side by side in `width` pixels (at least one). */
export function tilesThatFit(width: number, tile: number, gap: number): number {
  return Math.max(1, Math.floor((width + gap) / (tile + gap)))
}

/**
 * What one row of the card's media shows: the tiles, then a "+N more" tile in the next place when
 * there are more media than fit. The "+N more" tile takes the last place, so with N hidden the row
 * still shows `fit - 1` media (never fewer than one).
 */
export function rowOf(total: number, fit: number): { shown: number; hidden: number } {
  if (total <= fit) return { shown: total, hidden: 0 }
  const shown = Math.max(1, fit - 1)
  return { shown, hidden: total - shown }
}
