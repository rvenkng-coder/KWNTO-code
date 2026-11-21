import { useCallback, useEffect, useState } from 'react'
import { backend } from '../../../backend'

export const DEFAULT_FONT_SIZE = 13
export const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24]

export interface ViewPrefs { minimap: boolean; toggleMinimap(): void; fontSize: number; setFontSize(size: number): void }

/** The account's canvas view choices (user_preferences): the minimap and the card font size. Shown at their defaults until they load. */
export function useViewPrefs(): ViewPrefs {
  const [minimap, setMinimap] = useState(true)
  const [fontSize, setFont] = useState(DEFAULT_FONT_SIZE)
  useEffect(() => {
    let cancelled = false
    backend.preferences.get()
      .then((p) => {
        if (cancelled) return
        setMinimap(p.minimapVisible)
        if (p.cardFontSize > 0) setFont(p.cardFontSize)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
  const toggleMinimap = useCallback(() => {
    setMinimap((v) => {
      void backend.preferences.set({ minimapVisible: !v }).catch(() => undefined)
      return !v
    })
  }, [])
  const setFontSize = useCallback((size: number) => {
    setFont(size)
    void backend.preferences.set({ cardFontSize: size }).catch(() => undefined)
  }, [])
  return { minimap, toggleMinimap, fontSize, setFontSize }
}
