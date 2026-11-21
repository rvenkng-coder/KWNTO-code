import { askConfirm } from '../../shell/dialogs'
import { useCallback, useState, type ReactNode } from 'react'
import type { Chapter } from '../../../backend'
import { shiftChapter, trashChapter } from './chapterActions'
import { Popover } from './Popover'

interface TabMenuProps {
  chapter: Chapter
  /** Every live chapter, in position order. */
  ordered: Chapter[]
  onRename(): void
  /** Called once the trash is confirmed, before the chapter is gone, so the tab bar can move on. */
  onTrash(): void
}

function Item({ onClick, disabled = false, children }: { onClick(): void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" role="menuitem" className="btn text-left" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}

/** A tab's ▾ menu: Rename, Move left, Move right and Move to trash. */
export function TabMenu({ chapter, ordered, onRename, onTrash }: TabMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const close = useCallback(() => setAnchor(null), [])
  const at = ordered.findIndex((c) => c.id === chapter.id)
  const choose = (action: () => void) => () => {
    close()
    action()
  }
  const trash = () => {
    void askConfirm(`Move "${chapter.title}" to the trash?`, 'Move to trash').then((yes) => {
      if (!yes) return
      onTrash()
      void trashChapter(chapter.id)
    })
  }
  return (
    <>
      <button
        type="button"
        className="px-1"
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        aria-label={`Menu for ${chapter.title}`}
        onClick={(e) => setAnchor(anchor === null ? e.currentTarget : null)}
      >
        ▾
      </button>
      {anchor !== null && (
        <Popover anchor={anchor} label="Chapter menu" onClose={close}>
          <Item onClick={choose(onRename)}>Rename</Item>
          <Item disabled={at <= 0} onClick={choose(() => void shiftChapter(ordered, chapter.id, 'left'))}>Move left</Item>
          <Item disabled={at === ordered.length - 1} onClick={choose(() => void shiftChapter(ordered, chapter.id, 'right'))}>Move right</Item>
          <Item onClick={choose(trash)}>Move to trash</Item>
        </Popover>
      )}
    </>
  )
}
