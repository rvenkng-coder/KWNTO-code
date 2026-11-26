import type { ComponentProps } from 'react'
import { ToolButton } from '../canvas/ToolButton'

export const CARD = 'flex flex-col gap-2 rounded-[var(--radius)] border bg-card p-2'

/** The grip a row is dragged by (or moved with Alt+Up and Alt+Down while it has focus); the drag itself is in rowDrag.ts. */
export function Grip({ what, extra }: { what: string; extra: ComponentProps<typeof ToolButton>['extra'] }) {
  return (
    <ToolButton
      icon="grip"
      name={`Drag ${what}`}
      hint="or Alt+Up or Alt+Down"
      align="start"
      extra={extra}
      onClick={() => undefined}
    />
  )
}

/** The Add button under a list: a plus icon whose tooltip names it. */
export function AddButton({ name, onClick }: { name: string; onClick(): void }) {
  return (
    <div>
      <ToolButton icon="add" name={name} align="start" onClick={onClick} />
    </div>
  )
}
