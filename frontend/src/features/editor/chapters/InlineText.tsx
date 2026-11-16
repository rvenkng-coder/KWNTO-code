import { useState } from 'react'

interface InlineTextProps {
  value: string
  /** The accessible name of the box that appears while editing. */
  label: string
  onCommit: (next: string) => void
  onClick?: () => void
  className?: string
}

/** A text that turns into a box on double-click; Enter or leaving the box saves, Escape cancels. */
export function InlineText({ value, label, onCommit, onClick, className }: InlineTextProps) {
  const [editing, setEditing] = useState(false)
  if (!editing) {
    return (
      <button type="button" className={className} onClick={onClick} onDoubleClick={() => setEditing(true)}>
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
