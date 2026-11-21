import { useEffect, useRef, useState } from 'react'
import { SignOutButton } from './SignOutButton'

/** The signed-in person as an icon; it opens a small menu with their name and Sign out. */
export function UserMenu({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (box.current !== null && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <div ref={box} className="relative">
      <button
        type="button" data-testid="session-user" className="btn inline-flex h-8 w-8 items-center justify-center rounded-full p-0"
        aria-haspopup="menu" aria-expanded={open} title={name} onClick={() => setOpen(!open)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
        <span className="sr-only">{name}</span>
      </button>
      {open && (
        <div role="menu" className="panel absolute right-0 top-full z-40 mt-1 flex min-w-40 flex-col gap-2 shadow-lg">
          <span className="text-sm text-muted">{name}</span>
          <SignOutButton onSignOut={onSignOut} />
        </div>
      )}
    </div>
  )
}
