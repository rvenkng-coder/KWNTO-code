import type { Chapter, Connection, Cue, ProjectContent, ScriptLine, StoryNode } from '../../../backend'

// Test builders for the editor model and store tests: a record with sensible defaults.
export const chapter = (id: string, over: Partial<Chapter> = {}): Chapter =>
  ({ id, projectId: 'p1', title: id, position: 1, deleted: false, deletedAt: null, version: 0, ...over })
export const node = (id: string, over: Partial<StoryNode> = {}): StoryNode =>
  ({ id, projectId: 'p1', chapterId: 'c1', title: id, color: 'slate', x: 0, y: 0, width: 0, height: 0, coverMediaId: '', deleted: false, deletedAt: null, version: 0, ...over })
export const line = (id: string, over: Partial<ScriptLine> = {}): ScriptLine =>
  ({ id, projectId: 'p1', nodeId: 'n1', character: '', text: id, sortOrder: 1, version: 0, ...over })
export const cue = (id: string, over: Partial<Cue> = {}): Cue =>
  ({ id, projectId: 'p1', nodeId: 'n1', type: 'other', text: id, sortOrder: 1, version: 0, ...over })
export const connection = (id: string, from: string, to: string | null, over: Partial<Connection> = {}): Connection =>
  ({ id, projectId: 'p1', fromNodeId: from, toNodeId: to, label: '', created: '2026-11-18T10:00:00.000Z', version: 0, ...over })

export function content(over: Partial<ProjectContent> = {}): ProjectContent {
  return {
    project: { id: 'p1', teamId: 't1', name: 'Story', startNodeId: null, deleted: false, deletedAt: null, version: 0 },
    settings: { id: 's1', projectId: 'p1', analyticsEnabled: false, version: 0 },
    chapters: [chapter('c1')], nodes: [], lines: [], cues: [], connections: [],
    ...over,
  }
}
