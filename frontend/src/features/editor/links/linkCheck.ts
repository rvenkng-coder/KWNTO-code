// The address rule for node links, as the browser checks it before asking the server. A copy of
// backend/pb_hooks/lib/link-check.js (plan 2026-11-21-node-links, D4): only http and https addresses with
// a host; no spaces, no user name in front of the host, no other scheme. A rules test keeps the two in step.
const MAX_LENGTH = 2000
const WEB_ADDRESS = /^(https?):\/\/([^\s\/?#@\\]+)([\/?#]\S*)?$/i

export type LinkCheck = { ok: true; url: string } | { ok: false; message: string }

function refuse(message: string): LinkCheck {
  return { ok: false, message }
}

export function checkLinkUrl(raw: string): LinkCheck {
  const url = raw.trim()
  if (url === '') return refuse('Enter a web address.')
  if (url.length > MAX_LENGTH) return refuse('The address is longer than 2000 characters.')
  if (WEB_ADDRESS.test(url)) return { ok: true, url }
  if (/^https?:\/\//i.test(url)) return refuse('That is not a web address.')
  if (url.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return refuse('Only http:// and https:// addresses are allowed.')
  }
  return refuse('That is not a web address.')
}

// The host (and port) of a stored address, lower-cased, to show beside a link.
export function linkHost(url: string): string {
  const match = WEB_ADDRESS.exec(url)
  return match?.[2]?.toLowerCase() ?? ''
}

// What a link is called in the list: its title, or its host when it has none.
export function linkLabel(link: { title: string; url: string }): string {
  const title = link.title.trim()
  return title !== '' ? title : linkHost(link.url)
}
