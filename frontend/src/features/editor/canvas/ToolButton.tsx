import { useEffect, useId, useRef, useState, type HTMLAttributes } from 'react'
import { Icon, type IconName } from './icons'

// One icon button with a tooltip (editor cards design, goal 3). The tooltip shows after about 300 ms
// of hover and at once on keyboard focus, and reads `name (hint)`, or just `name`. A button that
// cannot act is `aria-disabled` rather than `disabled`, so it can still be focused and explain itself.

const HOVER_MS = 300

interface ToolButtonProps {
  icon: IconName
  name: string
  hint?: string
  onClick(): void
  disabled?: boolean
  pressed?: boolean
  /** Red, for a button that deletes. */
  danger?: boolean
  /** Where the tooltip sits under the button; `start` and `end` keep it inside a narrow panel. */
  align?: 'start' | 'center' | 'end'
  /** Extra attributes on the button, such as the drag attributes of a drag handle. */
  extra?: HTMLAttributes<HTMLButtonElement>
}

const TIP_ALIGN = { start: 'left-0', center: 'left-1/2 -translate-x-1/2', end: 'right-0' } as const

export function ToolButton({
  icon,
  name,
  hint,
  onClick,
  disabled = false,
  pressed,
  danger = false,
  align = 'center',
  extra,
}: ToolButtonProps) {
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
      <button
        type="button"
        {...extra}
        data-grip={extra?.draggable === true ? '' : undefined}
        aria-label={name}
        aria-disabled={disabled}
        aria-pressed={pressed}
        aria-describedby={shown ? tipId : undefined}
        className={`btn inline-flex h-8 w-8 items-center justify-center p-0 ${pressed === true ? 'border-accent text-accent' : ''} ${danger ? 'border-danger text-danger' : ''} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        onClick={() => {
          if (!disabled) onClick()
        }}
        onMouseEnter={() => {
          cancel()
          timer.current = setTimeout(() => setShown(true), HOVER_MS)
        }}
        onMouseLeave={hide}
        onFocus={() => setShown(true)}
        onBlur={hide}
        onKeyDown={(e) => {
          if (e.key === 'Escape') hide()
        }}
      >
        <Icon name={icon} />
      </button>
      {shown && (
        <span
          id={tipId}
          role="tooltip"
          className={`panel pointer-events-none absolute top-full z-30 mt-1 whitespace-nowrap ${TIP_ALIGN[align]} px-2 py-1 text-xs`}
        >
          {hint === undefined ? name : `${name} (${hint})`}
        </span>
      )}
    </span>
  )
}
