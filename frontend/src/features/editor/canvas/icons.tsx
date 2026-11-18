// The tool strip's icons (editor cards design, goal 3): hand-written inline SVG in the text colour,
// 16 px, drawn with strokes. No icon library: about eight icons do not justify one.

import type { ReactElement } from 'react'

export type IconName = 'add' | 'cut' | 'copy' | 'paste' | 'trash' | 'select' | 'panel'

const SHAPES: Record<IconName, ReactElement> = {
  add: <path d="M8 3v10M3 8h10" />,
  cut: (
    <>
      <circle cx="4.5" cy="12" r="1.8" />
      <circle cx="11.5" cy="12" r="1.8" />
      <path d="M5.7 10.6 12 3M10.3 10.6 4 3" />
    </>
  ),
  copy: (
    <>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1" />
      <path d="M3 10.5V4a1 1 0 0 1 1-1h6.5" />
    </>
  ),
  paste: (
    <>
      <rect x="3.5" y="3.5" width="9" height="10.5" rx="1" />
      <rect x="6" y="2" width="4" height="3" rx="0.8" />
    </>
  ),
  trash: <path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5" />,
  select: <rect x="2.5" y="2.5" width="11" height="11" strokeDasharray="2 2" />,
  panel: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M6 3v10" />
    </>
  ),
}

export function Icon({ name }: { name: IconName }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {SHAPES[name]}
    </svg>
  )
}
