const ID = /^[a-z0-9]{15}$/

export type Route =
  | { name: 'teams' }
  | { name: 'team'; teamId: string }
  | { name: 'project'; projectId: string; chapterId: string | null }

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

function parseSegments(parts: string[]): Route {
  return parseTeam(parts) ?? parseProject(parts) ?? FALLBACK
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
    case 'project':
      if (route.chapterId !== null) return `#/project/${route.projectId}/chapter/${route.chapterId}`
      return `#/project/${route.projectId}`
  }
}
