import type { NodeColor } from '../../../backend'

// The node header palette. This is the one place a hex colour is allowed
// (plan Global Constraints, "Styling"): the eight colours are data a node carries, not theme.
// Each header holds white text, so every colour is dark enough for it in both themes.

export const NODE_COLORS: Record<NodeColor, { light: string; dark: string }> = {
  slate: { light: '#475569', dark: '#334155' },
  red: { light: '#dc2626', dark: '#b91c1c' },
  orange: { light: '#c2410c', dark: '#9a3412' },
  amber: { light: '#b45309', dark: '#92400e' },
  green: { light: '#15803d', dark: '#166534' },
  teal: { light: '#0f766e', dark: '#115e59' },
  blue: { light: '#2563eb', dark: '#1d4ed8' },
  purple: { light: '#7c3aed', dark: '#6d28d9' },
}

export const DEFAULT_NODE_COLOR: NodeColor = 'blue'
