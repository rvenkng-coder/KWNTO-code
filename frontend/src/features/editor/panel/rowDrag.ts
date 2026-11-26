import { useState, type DragEvent, type HTMLAttributes, type KeyboardEvent } from 'react'

// Reordering script lines and cues by dragging a row's grip (native drag and drop, no library).
// The keyboard way: focus the grip and press Alt+Up or Alt+Down. One drag at a time, so the
// dragged row is kept here rather than read back from the event (browsers hide it while dragging over).

let dragged: { kind: string; id: string } | null = null

interface Drag {
  /** True while another row of the same list is held over this one. */
  over: boolean
  /** Put on the row (the `li`): the drop target and the keyboard moves. */
  row: HTMLAttributes<HTMLElement>
  /** Put on the grip button: what makes it draggable. */
  grip: HTMLAttributes<HTMLButtonElement>
}

export function useRowDrag(
  kind: string,
  id: string,
  index: number,
  onMove: (toIndex: number) => void,
  onDropFrom: (fromId: string) => void,
): Drag {
  const [over, setOver] = useState(false)
  const accepts = () => dragged !== null && dragged.kind === kind && dragged.id !== id
  return {
    over,
    row: {
      onDragOver: (e: DragEvent) => {
        if (!accepts()) return
        e.preventDefault()
        setOver(true)
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: DragEvent) => {
        setOver(false)
        if (dragged === null || !accepts()) return
        e.preventDefault()
        onDropFrom(dragged.id)
      },
      onKeyDown: (e: KeyboardEvent) => {
        if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
        if ((e.target as HTMLElement).closest('[data-grip]') === null) return
        e.preventDefault()
        onMove(index + (e.key === 'ArrowUp' ? -1 : 1))
      },
    },
    grip: {
      draggable: true,
      onDragStart: (e: DragEvent) => {
        dragged = { kind, id }
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', id)
        const row = (e.currentTarget as HTMLElement).closest('li')
        if (row !== null) e.dataTransfer.setDragImage(row, 12, 12)
      },
      onDragEnd: () => {
        dragged = null
      },
    },
  }
}
