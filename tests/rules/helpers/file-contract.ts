// What the project file (docs/developer/project-file.md) does with every collection that belongs
// to a project, and with every field of the ones it imports. A new collection or field goes in
// one of these lists, or tests/rules/project-file.fields.rules.test.ts fails.

/** Fields that must be the same in an imported copy. */
export const CARRIED: Record<string, string[]> = {
  projects: ['name', 'start_node'],
  chapters: ['title', 'position'],
  nodes: ['chapter', 'title', 'color', 'x', 'y', 'width', 'height'],
  script_lines: ['node', 'character', 'text', 'sort_order'],
  cues: ['node', 'type', 'text', 'sort_order'],
  connections: ['from_node', 'to_node', 'label'],
  node_links: ['node', 'title', 'url'],
}

const NEW_ID = 'an import gives every record a new id'
const OWN_PROJECT = 'an import sets it to the new project'
const VERSION = 'the save counter of the version guard starts again'
const TRASH = 'trashed records are not exported'
const STAMP = 'the server sets it when the record is made'
const CONTENT = { id: NEW_ID, project: OWN_PROJECT, version: VERSION, created: STAMP, updated: STAMP }

/** The other fields of those collections, each with the reason an import does not copy it. */
export const NEVER_CARRIED: Record<string, Record<string, string>> = {
  projects: { id: NEW_ID, team: 'the team imported into', deleted_at: TRASH, version: VERSION, created: STAMP, updated: STAMP },
  chapters: { ...CONTENT, deleted_at: TRASH },
  nodes: {
    ...CONTENT,
    deleted_at: TRASH,
    cover_media: 'media files are not in the file, so an import has no image to point at (share views do show it)',
  },
  script_lines: CONTENT,
  cues: CONTENT,
  connections: { ...CONTENT, created: 'the order of the list in the file carries the order of choices' },
  node_links: { id: NEW_ID, project: OWN_PROJECT, creator: 'the person who imports', created: STAMP },
}

/** Collections of a project that an import makes nothing in. */
export const NOT_IMPORTED: Record<string, string> = {
  media: 'files are not in the file; it lists titles and kinds only',
  project_settings: 'a new project starts with default settings',
  share_links: 'a link opens one project only',
  link_grants: 'access given through a link does not move to a copy',
  comments: 'discussion about the original, not part of the story',
  presence: 'who is looking right now',
}
