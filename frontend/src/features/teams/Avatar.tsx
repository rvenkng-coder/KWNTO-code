import { initials } from './initials'

/** A round badge with a person's initials; the name is its tooltip. */
export function Avatar({ name }: { name: string }) {
  return (
    <span
      title={name}
      aria-hidden="true"
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-bg text-xs font-semibold text-text"
    >
      {initials(name)}
    </span>
  )
}
