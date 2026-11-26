import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type ReactPortal, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { menuPosition } from './menuPosition'

interface PopoverProps {
  anchor: HTMLElement
  label: string
  onClose(): void
  children: ReactNode
}

// A menu drawn in its own layer on `document.body`, so a scrolling tab strip cannot clip it and
// the canvas cannot cover it. It sits where `menuPosition` says, measured after the first render.
// It is never taller than the window and scrolls inside itself (a project with many chapters).
// It closes on Escape (focus goes back to its button), on a press outside it and its button, on
// a window resize and on any scroll that moves its button (decision E1). A scroll that leaves the
// button where it was is ignored: Chromium reports the scroll that brought a half-hidden button
// into view one frame after the click that opened the menu.
export function Popover({ anchor, label, onClose, children }: PopoverProps): ReactPortal {
  const menu = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const el = menu.current
    if (el === null) return
    const size = { width: el.offsetWidth, height: el.offsetHeight }
    setAt(menuPosition(anchor.getBoundingClientRect(), size, { width: window.innerWidth, height: window.innerHeight }))
  }, [anchor])

  useCloseRules(anchor, menu, onClose)

  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={label}
      className="panel fixed z-50 flex max-h-[calc(100vh-1rem)] flex-col gap-1 overflow-y-auto p-1"
      style={{ left: at?.left ?? 0, top: at?.top ?? 0, visibility: at === null ? 'hidden' : 'visible' }}
    >
      {children}
    </div>,
    document.body,
  )
}

function useCloseRules(anchor: HTMLElement, menu: RefObject<HTMLDivElement | null>, onClose: () => void): void {
  useEffect(() => {
    const inside = (target: EventTarget | null) =>
      target instanceof Node && (anchor.contains(target) || (menu.current?.contains(target) ?? false))
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      onClose()
      anchor.focus()
    }
    const onPress = (e: PointerEvent) => {
      if (!inside(e.target)) onClose()
    }
    const placed = anchor.getBoundingClientRect()
    const onScroll = () => {
      const now = anchor.getBoundingClientRect()
      if (now.left !== placed.left || now.top !== placed.top) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPress, true)
    window.addEventListener('resize', onClose)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPress, true)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [anchor, menu, onClose])
}
