import { useState } from 'react'
import type { ShareLink } from '../../backend'
import { permissionLabel, shareUrl } from './shareModel'

export const REVOKE_QUESTION = 'Revoke this link? Anyone using it loses access at once.'

interface LinkRowProps {
  link: ShareLink
  onRevoke: (link: ShareLink) => Promise<void>
  onRepublish: (link: ShareLink) => Promise<void>
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** One link of the project: what it allows, its date, and Copy, Republish and Revoke (the question is asked in the row). */
export function LinkRow({ link, onRevoke, onRepublish }: LinkRowProps) {
  const [asking, setAsking] = useState(false)
  const [copied, setCopied] = useState(false)
  const url = shareUrl(window.location.origin, link.token)

  async function copy() {
    setCopied(await copyToClipboard(url))
  }

  return (
    <li
      data-testid="link-row"
      className={`flex flex-col gap-1 rounded-base border border-border p-2 ${link.revoked ? 'opacity-60' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{permissionLabel(link.permission, link.kind)}</span>
        <span className="text-sm text-muted">{new Date(link.created).toLocaleDateString()}</span>
        {link.revoked && <span className="text-sm text-muted">Revoked</span>}
      </div>
      {!link.revoked && (
        <input
          readOnly
          aria-label="Link address"
          className="field text-sm"
          value={url}
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
      {!link.revoked && !asking && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn" onClick={() => void copy()}>
            Copy link
          </button>
          {copied && <span className="text-sm">Copied</span>}
          {link.kind === 'snapshot' && (
            <button type="button" className="btn" onClick={() => void onRepublish(link)}>
              Republish
            </button>
          )}
          <button type="button" className="btn" onClick={() => setAsking(true)}>
            Revoke
          </button>
        </div>
      )}
      {!link.revoked && asking && (
        <div className="flex flex-wrap items-center gap-2">
          <span>{REVOKE_QUESTION}</span>
          <button type="button" className="btn" onClick={() => void onRevoke(link).finally(() => setAsking(false))}>
            Revoke
          </button>
          <button type="button" className="btn" onClick={() => setAsking(false)}>
            Cancel
          </button>
        </div>
      )}
    </li>
  )
}
