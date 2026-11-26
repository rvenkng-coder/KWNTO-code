import { createContext } from 'react'
import type { ProjectFile } from '../../backend'

/** What a card of the shared canvas needs to load its cover. React Flow draws the cards, so it comes by context. */
export const CoverSource = createContext<{ token: string; needsSignIn: boolean; media: ProjectFile['media'] }>({
  token: '',
  needsSignIn: false,
  media: [],
})
