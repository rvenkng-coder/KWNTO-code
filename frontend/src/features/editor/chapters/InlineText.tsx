import { useState } from 'react'

interface InlineTextProps {
  value: string
  /** The accessible name of the box that appears while editing. */
  label: string
  onCommit: (next: string) => void
  onClick?: () => void
  className?: string
  /** Controlled when given (a menu can start the edit); otherwise the text keeps its own state. */
  editing?: boolean
  onEditingChange?: (editing: boolean) => void
  /** `tab` makes the shown text a tab of a tab list. */
  role?: 'tab'
  /** `aria-selected` of that tab. */
  selected?: boolean
}

/** A text that turns into a box on double-click; Enter or leaving the box saves, Escape cancels. */
export function InlineText({
  value,
  label,
  onCommit,
  onClick,
  className,
  editing: controlled,
  onEditingChange,
  role,
  selected,
}: InlineTextProps) {
  const [own, setOwn] = useState(false)
  const editing = controlled ?? own
  const setEditing = (next: boolean) => {
    if (controlled === undefined) setOwn(next)
    onEditingChange?.(next)
  }
  if (!editing) {
    return (
      <button
        type="button"
        role={role}
        aria-selected={role === 'tab' ? selected : undefined}
        className={className}
        onClick={onClick}
        onDoubleClick={() => setEditing(true)}
      >
        {value}
      </button>
    )
  }
  const finish = (next: string) => {
    setEditing(false)
    if (next.trim() !== '' && next !== value) onCommit(next.trim())
  }
  return (
    <input
      className="field"
      aria-label={label}
      defaultValue={value}
      autoFocus
      onBlur={(e) => finish(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setEditing(false)
      }}
    />
  )
}
