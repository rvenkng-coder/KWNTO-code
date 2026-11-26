import type { ProjectFile } from '../../backend'
import type { MediaKind } from '../../backend/media-types'
import { fromContent } from '../editor/model/state'
import { contentFromFile } from '../share/shareModel'
import { buildStory, type Story, type StoryMediaInput } from './story'

const KINDS: readonly string[] = ['audio', 'video', 'image']

/** The story a share link's project file holds: the same `Story` the editor's content gives. */
export function storyOfFile(file: ProjectFile, projectId: string): Story {
  const media: StoryMediaInput[] = file.media
    .filter((m) => KINDS.includes(m.kind))
    .map((m) => ({ id: m.id, nodeId: m.node, title: m.title, kind: m.kind as MediaKind }))
  return buildStory(fromContent(contentFromFile(file, projectId)), media)
}
