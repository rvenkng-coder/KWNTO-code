import { useEffect, useId, useRef, useState } from 'react'
import { Icon, type IconName } from './icons'

// One icon button with a tooltip (editor cards design, goal 3). The tooltip shows after about 300 ms
// of hover and at once on keyboard focus, and reads `name (hint)`, or just `name`. A button that
// cannot act is `aria-disabled` rather than `disabled`, so it can still be focused and explain itself.

const HOVER_MS = 300

interface ToolButtonProps { icon: IconName; name: string; hint?: string; onClick(): void; disabled?: boolean; pressed?: boolean }

export function ToolButton({ icon, name, hint, onClick, disabled = false, pressed }: ToolButtonProps) {
  const [shown, setShown] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tipId = useId()
  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => cancel, [])
  const hide = () => {
    cancel()
    setShown(false)
  }
  return (
    <span className="relative inline-flex">
      <button type="button" aria-label={name} aria-disabled={disabled} aria-pressed={pressed} aria-describedby={shown ? tipId : undefined}
        className={`btn inline-flex h-8 w-8 items-center justify-center p-0 ${pressed === true ? 'border-accent text-accent' : ''} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        onClick={() => {
          if (!disabled) onClick()
        }}
        onMouseEnter={() => {
          cancel()
          timer.current = setTimeout(() => setShown(true), HOVER_MS)
        }}
        onMouseLeave={hide} onFocus={() => setShown(true)} onBlur={hide}
        onKeyDown={(e) => {
          if (e.key === 'Escape') hide()
        }}>
        <Icon name={icon} />
      </button>
      {shown && (
        <span id={tipId} role="tooltip" className="panel pointer-events-none absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2 whitespace-nowrap px-2 py-1 text-xs">
          {hint === undefined ? name : `${name} (${hint})`}
        </span>
      )}
    </span>
  )
}
