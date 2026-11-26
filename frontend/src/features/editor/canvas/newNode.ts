import type { StoryNode } from '../../../backend'
import { DEFAULT_NODE_COLOR } from '../model/colors'
import { newId } from '../model/ids'

export interface Point { x: number; y: number }

/** How far a new node steps right and down when the spot is already taken. */
export const NODE_STEP = 40

/** A new live node of the chapter at `at` (rounded): title `New node`, colour DEFAULT_NODE_COLOR, version 0, a fresh id. */
export function newNodeRecord(projectId: string, chapterId: string, at: Point): StoryNode {
  return {
    id: newId(), projectId, chapterId, title: 'New node', color: DEFAULT_NODE_COLOR,
    x: Math.round(at.x), y: Math.round(at.y), width: 0, height: 0, coverMediaId: '', deleted: false, deletedAt: null, version: 0,
  }
}

/** `at` rounded, stepped 40 px right and down while a node already sits exactly on it. */
export function freeSpot(at: Point, taken: readonly Point[]): Point {
  let spot = { x: Math.round(at.x), y: Math.round(at.y) }
  while (taken.some((p) => p.x === spot.x && p.y === spot.y)) spot = { x: spot.x + NODE_STEP, y: spot.y + NODE_STEP }
  return spot
}
