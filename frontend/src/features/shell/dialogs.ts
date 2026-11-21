import { create } from 'zustand'

// In-page replacements for the browser's confirm() and prompt(): call `askConfirm` or `askText`,
// await the answer, and <DialogHost /> (mounted once in the shell) draws the question.

export type DialogRequest =
  | { kind: 'confirm'; message: string; confirmLabel: string; resolve(ok: boolean): void }
  | { kind: 'prompt'; label: string; confirmLabel: string; resolve(text: string | null): void }

interface DialogState { current: DialogRequest | null }

export const useDialogs = create<DialogState>(() => ({ current: null }))

// A second question asked while one is open cancels the first, so no caller waits forever.
function open(request: DialogRequest): void {
  const previous = useDialogs.getState().current
  if (previous?.kind === 'confirm') previous.resolve(false)
  else if (previous?.kind === 'prompt') previous.resolve(null)
  useDialogs.setState({ current: request })
}

/** Asks a yes/no question; resolves true only when the person confirms. */
export function askConfirm(message: string, confirmLabel = 'OK'): Promise<boolean> {
  return new Promise((resolve) => open({ kind: 'confirm', message, confirmLabel, resolve }))
}

/** Asks for one line of text; resolves null when the person cancels. */
export function askText(label: string, confirmLabel = 'Create'): Promise<string | null> {
  return new Promise((resolve) => open({ kind: 'prompt', label, confirmLabel, resolve }))
}
