import { useMemo, useState } from 'react'
import {
  back,
  choose as chooseStep,
  historyOf,
  screenOf,
  startSession,
  type HistoryEntry,
  type Screen,
  type Session,
} from './session'
import type { Story } from './story'

export type Transition = 'fade' | 'slide-forward' | 'slide-back'

export const EMPTY_CHOICE_NOTE = "This choice isn't linked to a node yet."

interface State {
  session: Session | null
  transition: Transition
  moves: number
  note: string | null
}

export interface PlayerApi {
  screen: Screen | null
  history: HistoryEntry[]
  transition: Transition
  moves: number
  note: string | null
  choose(choiceId: string): void
  back(): void
  restart(): void
}

/** The player's state. It keeps the story it was first given: a later edit cannot change a screen or break a path. */
export function usePlayer(story: Story): PlayerApi {
  const [frozen] = useState(story)
  const [state, setState] = useState<State>(() => ({
    session: startSession(frozen),
    transition: 'fade',
    moves: 0,
    note: null,
  }))
  const { session } = state
  const screen = useMemo(() => (session === null ? null : screenOf(frozen, session)), [frozen, session])
  const history = useMemo(() => (session === null ? [] : historyOf(frozen, session)), [frozen, session])
  return {
    screen,
    history,
    transition: state.transition,
    moves: state.moves,
    note: state.note,
    choose: (choiceId) =>
      setState((s) => {
        const next = s.session === null ? null : chooseStep(frozen, s.session, choiceId)
        if (next === null) return { ...s, note: EMPTY_CHOICE_NOTE }
        return { session: next, transition: 'slide-forward', moves: s.moves + 1, note: null }
      }),
    back: () =>
      setState((s) =>
        s.session === null ? s : { session: back(s.session), transition: 'slide-back', moves: s.moves + 1, note: null },
      ),
    restart: () =>
      setState((s) => ({ session: startSession(frozen), transition: 'fade', moves: s.moves + 1, note: null })),
  }
}
