import type { ReactNode } from 'react'

/** A panel section's heading as a small uppercase label (editor cards design, goal 4); still an h3 named Script, Cues or Choices. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="section-label">{children}</h3>
}
