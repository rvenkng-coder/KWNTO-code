import type { NodeLink } from '../../../backend/link-types.ts'
import { linkHost, linkLabel } from './linkCheck.ts'

interface LinkItemProps {
  link: NodeLink
  onDelete: (link: NodeLink) => Promise<void>
}

// One link: its title (or host), the host in muted text, and a delete button. The title is rendered as
// text only. The address opens in a new tab and never gets the opener (plan node-links, security.md).
export function LinkItem({ link, onDelete }: LinkItemProps) {
  const label = linkLabel(link)
  const host = linkHost(link.url)
  return (
    <div
      data-testid="link-item"
      className="panel flex items-center gap-2 rounded-base border border-border p-2 bg-surface text-text"
    >
      <div className="flex flex-1 flex-col overflow-hidden">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-sm font-medium underline"
          title={link.url}
        >
          {label}
        </a>
        {label !== host && <span className="truncate text-xs text-muted">{host}</span>}
      </div>
      <button type="button" className="btn btn-sm self-center text-xs" onClick={() => void onDelete(link)}>
        Delete link
      </button>
    </div>
  )
}
