import type { ReactNode } from 'react'
import type { ProjectFile } from '../../backend'
import { ShareLinks } from './ShareLinks'
import { ShareMedia } from './ShareMedia'

interface ReadOnlyPanelProps {
  file: ProjectFile
  nodeId: string
  token: string
  needsSignIn: boolean
  /** Shown under the node's content: the comments, for a comment link. */
  children?: ReactNode
}

/** A node's content as text only (security.md 5): title, script lines, choices, cues, media and links. */
export function ReadOnlyPanel({ file, nodeId, token, needsSignIn, children }: ReadOnlyPanelProps) {
  const node = file.nodes.find((n) => n.id === nodeId)
  if (node === undefined) return null
  const byOrder = <T extends { sortOrder: number; id: string }>(a: T, b: T) =>
    a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)
  const lines = file.lines.filter((l) => l.node === nodeId).sort(byOrder)
  const cues = file.cues.filter((q) => q.node === nodeId).sort(byOrder)
  const choices = file.connections.filter((k) => k.from === nodeId)
  const media = file.media.filter((m) => m.node === nodeId)
  const titleOf = (id: string | null) => file.nodes.find((n) => n.id === id)?.title || 'Untitled'
  return (
    <aside data-testid="readonly-panel" className="panel flex min-h-0 flex-col gap-3 overflow-y-auto">
      <h3 className="text-lg font-semibold">{node.title || 'Untitled'}</h3>
      <section className="flex flex-col gap-1">
        {lines.map((l) => (
          <p key={l.id}>
            {l.character !== '' && <strong>{l.character}: </strong>}
            {l.text}
          </p>
        ))}
      </section>
      {choices.length > 0 && (
        <ul className="flex flex-col gap-1">
          {choices.map((k) => (
            <li key={k.id}>
              {k.label || 'Untitled'}
              {k.to !== null && <span className="text-muted">{` → ${titleOf(k.to)}`}</span>}
            </li>
          ))}
        </ul>
      )}
      {cues.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {cues.map((q) => (
            <li key={q.id}>
              <span className="text-accent">{q.type}</span> {q.text}
            </li>
          ))}
        </ul>
      )}
      {media.map((m) => (
        <ShareMedia key={m.id} token={token} media={m} needsSignIn={needsSignIn} />
      ))}
      <ShareLinks links={(file.links ?? []).filter((l) => l.node === nodeId)} />
      {children}
    </aside>
  )
}
