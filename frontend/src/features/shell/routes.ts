const ID = /^[a-z0-9]{15}$/
// A mail link carries a JWT: three URL-safe parts joined by dots.
const TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

export type Route =
  | { name: 'teams' }
  | { name: 'team'; teamId: string }
  | { name: 'project'; projectId: string; chapterId: string | null }
  | { name: 'verify'; token: string }
  | { name: 'reset'; token: string }

const FALLBACK: Route = { name: 'teams' }

function parseTeam(parts: string[]): Route | undefined {
  if (parts[0] !== 'team' || parts.length !== 2) return undefined
  const id = parts[1]!
  return ID.test(id) ? { name: 'team', teamId: id } : undefined
}

function parseProject(parts: string[]): Route | undefined {
  if (parts[0] !== 'project' || parts.length < 2) return undefined
  const projectId = parts[1]!
  if (!ID.test(projectId)) return undefined
  if (parts.length === 2) return { name: 'project', projectId, chapterId: null }
  if (parts[2] === 'chapter' && parts.length === 4) {
    const chapterId = parts[3]!
    if (ID.test(chapterId)) return { name: 'project', projectId, chapterId }
  }
  return undefined
}

function parseMailLink(parts: string[]): Route | undefined {
  const name = parts[0]
  if ((name !== 'verify' && name !== 'reset') || parts.length !== 2) return undefined
  const token = parts[1]!
  return token.length <= 2048 && TOKEN.test(token) ? { name, token } : undefined
}

function parseSegments(parts: string[]): Route {
  return parseTeam(parts) ?? parseProject(parts) ?? parseMailLink(parts) ?? FALLBACK
}

export function parseRoute(hash: string): Route {
  try {
    const body = hash.replace(/^#\/?/, '')
    if (body === '') return FALLBACK
    let parts = body.split('/')
    if (parts[parts.length - 1] === '') parts = parts.slice(0, -1)
    if (parts.length === 0) return FALLBACK
    return parseSegments(parts)
  } catch {
    return FALLBACK
  }
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'teams':
      return '#/'
    case 'team':
      return `#/team/${route.teamId}`
    case 'verify':
      return `#/verify/${route.token}`
    case 'reset':
      return `#/reset/${route.token}`
    case 'project':
      if (route.chapterId !== null) return `#/project/${route.projectId}/chapter/${route.chapterId}`
      return `#/project/${route.projectId}`
  }
}
