import { useSyncExternalStore } from 'react'
import { parseRoute, routeToHash, type Route } from './routes'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

const getHash = (): string => window.location.hash

// Holds the last route so the same hash gives the same object (no needless re-render).
let lastHash: string | null = null
let lastRoute: Route = { name: 'teams' }

function getRoute(): Route {
  const hash = getHash()
  if (hash !== lastHash) {
    lastHash = hash
    lastRoute = parseRoute(hash)
  }
  return lastRoute
}

/** The current route; re-renders when the hash changes. */
export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getRoute)
}

export function navigate(route: Route): void {
  window.location.hash = routeToHash(route)
}
