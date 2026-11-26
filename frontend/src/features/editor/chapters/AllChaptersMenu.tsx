import { useCallback, useState } from 'react'
import type { Chapter } from '../../../backend'
import { Popover } from './Popover'

interface AllChaptersMenuProps {
  /** Every live chapter, in position order, including those whose tab is closed. */
  chapters: Chapter[]
  activeId: string | null
  /** Reopens the chapter's tab if it is closed and shows it. */
  onShow(id: string): void
  /** Opens the project's trash (the last item of the menu). */
  onTrash(): void
}

/** "≡" at the start of the tab bar: every chapter; the open one is marked current. */
export function AllChaptersMenu({ chapters, activeId, onShow, onTrash }: AllChaptersMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const close = useCallback(() => setAnchor(null), [])
  return (
    <>
      <button
        type="button"
        className="shrink-0 border-r border-border px-2"
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        aria-label="All chapters"
        onClick={(e) => setAnchor(anchor === null ? e.currentTarget : null)}
      >
        ≡
      </button>
      {anchor !== null && (
        <Popover anchor={anchor} label="All chapters" onClose={close}>
          {chapters.map((c) => (
            <button
              key={c.id}
              type="button"
              role="menuitem"
              aria-current={c.id === activeId ? 'true' : undefined}
              className={`btn text-left ${c.id === activeId ? 'font-semibold' : ''}`}
              onClick={() => {
                close()
                onShow(c.id)
              }}
            >
              {c.title}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            className="btn border-t border-border text-left"
            onClick={() => {
              close()
              onTrash()
            }}
          >
            Trash
          </button>
        </Popover>
      )}
    </>
  )
}
