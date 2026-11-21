import type { MapImage } from '../../../../frontend/src/features/editor/export/exportPlan'

export const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
export const map = (chapterTitle: string, width: number, height: number): MapImage =>
  ({ chapterTitle, dataUrl: PNG, width, height, small: false })
export const bytesOf = async (b: Blob) => new Uint8Array(await b.arrayBuffer())
