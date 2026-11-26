import type { ProjectFile } from '../../backend'
import { linkHost, linkLabel, safeHref } from '../editor/links/linkCheck'

/** The shared node's links. An address is a link only when the browser's own check accepts it too. */
export function ShareLinks({ links }: { links: NonNullable<ProjectFile['links']> }) {
  if (links.length === 0) return null
  return (
    <section data-testid="share-links" className="flex flex-col gap-1 text-sm">
      <h4 className="font-semibold">Links and other material</h4>
      <ul className="flex flex-col gap-1">
        {links.map((l) => {
          const href = safeHref(l.url)
          return (
            <li key={l.id} className="flex flex-col">
              {href === null
                ? <span className="text-muted">{linkLabel(l)}</span>
                : <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-accent hover:underline">{linkLabel(l)}</a>}
              <span className="break-all text-xs text-muted">{linkHost(l.url)}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
