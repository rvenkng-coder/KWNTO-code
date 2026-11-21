import { useCallback, useEffect, type KeyboardEvent, type RefObject } from 'react'

const FOCUSABLE = 'input:not(:disabled), button:not(:disabled)'

/** Moves focus round inside the box instead of out of it. */
function trapTab(e: KeyboardEvent<HTMLElement>, box: HTMLElement): void {
  const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE))
  const first = items[0]
  const last = items[items.length - 1]
  if (first === undefined || last === undefined) return e.preventDefault()
  const at = document.activeElement
  if (e.shiftKey && (at === first || at === box)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && at === last) {
    e.preventDefault()
    first.focus()
  }
}

/**
 * Key handling of a modal dialog: Tab cycles inside it, Escape closes it unless `locked`, and no key reaches
 * the editor's window-level shortcuts behind it (a key pressed in the dialog stops here).
 */
export function useModalKeys(box: RefObject<HTMLElement | null>, locked: boolean, onClose: () => void) {
  return useCallback((e: KeyboardEvent<HTMLElement>) => {
    e.stopPropagation()
    if (e.key === 'Escape' && !locked) onClose()
    if (e.key === 'Tab' && box.current !== null) trapTab(e, box.current)
  }, [box, locked, onClose])
}

/** Keeps focus inside a modal box: focus on the checked radio when it opens, and back in the box whenever something outside takes it. */
export function useFocusGuard(box: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = box.current
    if (element === null) return
    const checked = element.querySelector<HTMLElement>('input:checked')
    ;(checked ?? element).focus()
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof Node && !element.contains(e.target)) element.focus()
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [box])
}
