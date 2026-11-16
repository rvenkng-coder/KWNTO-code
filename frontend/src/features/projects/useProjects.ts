import { useCallback, useEffect, useState } from 'react'
import { backend, type Project } from '../../backend'
import { errorMessage } from '../errorMessage'

/** The projects of one team: the list, and the two things the list does (create, trash). */
export function useProjects(teamId: string) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let current = true
    backend.projects
      .list(teamId)
      .then((list) => current && setProjects(list))
      .catch((err: unknown) => current && setError(errorMessage(err, 'Failed to load projects')))
      .finally(() => current && setLoaded(true))
    return () => {
      current = false
    }
  }, [teamId, reloadKey])

  async function create(name: string): Promise<boolean> {
    setError(null)
    try {
      await backend.projects.create(teamId, name)
      reload()
      return true
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to create project'))
      return false
    }
  }

  async function trash(project: Project): Promise<void> {
    setError(null)
    try {
      await backend.content.update('projects', project.id, { deleted: true }, project.version)
      reload()
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to move the project to the trash'))
    }
  }

  return { projects, loaded, error, create, trash }
}
