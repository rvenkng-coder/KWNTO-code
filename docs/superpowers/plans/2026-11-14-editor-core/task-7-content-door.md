# Task 7: The content door

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Tasks 5 and 6

The one place the editor reaches projects and their content. It owns the 409 retry rule of decision 0002 (re-read, re-apply only the caller's own fields, at most 20 tries) and the live subscriptions (D15). Screens never see a PocketBase record or a raw 409.

**Files:**
- Create: `frontend/src/backend/content-types.ts`, `frontend/src/backend/content-mappers.ts`, `frontend/src/backend/content-mappers.test.ts`, `frontend/src/backend/guarded.ts`, `frontend/src/backend/guarded.test.ts`, `frontend/src/backend/projects.ts`, `frontend/src/backend/content.ts`, `frontend/src/backend/realtime.ts`, `tests/rules/content-door.rules.test.ts`
- Modify: `frontend/src/backend/client.ts`, `frontend/src/backend/index.ts`, `docs/developer/backend.md`

**Interfaces:**
- Produces, `frontend/src/backend/content-types.ts`:

```ts
export type NodeColor = 'slate' | 'red' | 'orange' | 'amber' | 'green' | 'teal' | 'blue' | 'purple'
export type CueType = 'audio' | 'lighting' | 'other'
export interface Project { id: string; teamId: string; name: string; startNodeId: string | null; deleted: boolean; version: number }
export interface ProjectSettings { id: string; projectId: string; analyticsEnabled: boolean; version: number }
export interface Chapter { id: string; projectId: string; title: string; position: number; deleted: boolean; version: number }
export interface StoryNode { id: string; projectId: string; chapterId: string; title: string; color: NodeColor; x: number; y: number; deleted: boolean; version: number }
export interface ScriptLine { id: string; projectId: string; nodeId: string; character: string; text: string; sortOrder: number; version: number }
export interface Cue { id: string; projectId: string; nodeId: string; type: CueType; text: string; sortOrder: number; version: number }
export interface Connection { id: string; projectId: string; fromNodeId: string; toNodeId: string; label: string; version: number }
export interface ContentRecords { projects: Project; project_settings: ProjectSettings; chapters: Chapter; nodes: StoryNode; script_lines: ScriptLine; cues: Cue; connections: Connection }
export type ContentKind = keyof ContentRecords
export type CreatableKind = 'chapters' | 'nodes' | 'script_lines' | 'cues' | 'connections'
export type RemovableKind = 'script_lines' | 'cues' | 'connections'
export interface EditableFields {
  projects: Pick<Project, 'name' | 'startNodeId' | 'deleted'>
  project_settings: Pick<ProjectSettings, 'analyticsEnabled'>
  chapters: Pick<Chapter, 'title' | 'position' | 'deleted'>
  nodes: Pick<StoryNode, 'title' | 'color' | 'x' | 'y' | 'deleted'>
  script_lines: Pick<ScriptLine, 'character' | 'text' | 'sortOrder'>
  cues: Pick<Cue, 'type' | 'text' | 'sortOrder'>
  connections: Pick<Connection, 'label'>
}
export interface ProjectContent { project: Project; settings: ProjectSettings; chapters: Chapter[]; nodes: StoryNode[]; lines: ScriptLine[]; cues: Cue[]; connections: Connection[] }
export type RemoteEvent = { [K in ContentKind]: { kind: K; action: 'create' | 'update' | 'delete'; record: ContentRecords[K] } }[ContentKind]
```

- Produces, `frontend/src/backend/content-mappers.ts`: `fromRecord<K extends ContentKind>(kind: K, rec: Record<string, unknown>): ContentRecords[K]`; `toUpdateBody<K extends ContentKind>(kind: K, changes: Partial<EditableFields[K]>): Record<string, unknown>` (camelCase to the snake_case field names of Tasks 5 and 6; `deleted: true` becomes `deleted_at` = now as ISO text, `false` becomes `''` (D14); `startNodeId: null` becomes `''`; keys not given are not sent); `toCreateBody<K extends CreatableKind>(kind: K, record: ContentRecords[K]): Record<string, unknown>` (includes `id`, never `version` or `deleted_at`).
- Produces, `frontend/src/backend/guarded.ts`:

```ts
export const MAX_SAVE_TRIES = 20
export const TOO_BUSY = 'Could not save: too many people are editing this at once. Try again.'
export interface GuardedIO<R extends { version: number }> {
  read(): Promise<R>                                                // the current record
  write(body: Record<string, unknown>, version: number): Promise<R> // rejects with BackendError kind 'conflict' on 409
}
export async function guardedSave<R extends { version: number }>(io: GuardedIO<R>, body: Record<string, unknown>, baseVersion: number): Promise<R>
// write(body, baseVersion); on 'conflict': read(), then write(body, fresh.version); MAX_SAVE_TRIES writes in all;
// then rejects with BackendError('conflict', TOO_BUSY). Any other error (including from read) is rethrown at once.
```

- Produces, on `Backend`:

```ts
backend.projects: {
  list(teamId: string): Promise<Project[]>                 // not trashed, most recently updated first
  create(teamId: string, name: string): Promise<Project>
}
backend.content: {
  load(projectId: string): Promise<ProjectContent>         // everything of the project, trashed records included (the store hides them)
  create<K extends CreatableKind>(kind: K, record: ContentRecords[K]): Promise<ContentRecords[K]>
  update<K extends ContentKind>(kind: K, id: string, changes: Partial<EditableFields[K]>, baseVersion: number): Promise<ContentRecords[K]>
  remove(kind: RemovableKind, id: string): Promise<void>
  subscribe(projectId: string, onEvent: (event: RemoteEvent) => void): Promise<() => Promise<void>>
}
```

  Every method rejects with `BackendError`. `subscribe` opens one subscription per collection with `filter: project = <id>` (the `projects` collection: its one record) and returns a function that closes all seven.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 7A: Types, mappers and the retry loop (pure)

- [ ] **Step 1: Write the failing tests** C1 to C6 in `content-mappers.test.ts` and `guarded.test.ts` (fake `GuardedIO` objects that count calls; no PocketBase). Header comments cite decision 0002 ("the client must handle 409 as normal flow … bound the retries").
- [ ] **Step 2: Run** `npm run test:unit`. Expected: FAIL.
- [ ] **Step 3: Implement** `content-types.ts`, `content-mappers.ts`, `guarded.ts`. Write the loop's bound as `for (let attempt = 1; attempt <= MAX_SAVE_TRIES; attempt++)`, the rethrow as `if (error.kind !== 'conflict') throw error`, and the trash mapping as `deleted_at: changes.deleted ? new Date().toISOString() : ''` (breaks B1 to B3).
- [ ] **Step 4: Run** `npm run test:unit`. Expected: PASS. **Close checkpoint 7A** (commit `feat: content types, mappers and guarded save`).

## Checkpoint 7B: Projects and content calls

- [ ] **Step 5: Write the failing tests** C7 to C10 in `tests/rules/content-door.rules.test.ts`, driving `createBackend(PB_URL)` per person as `backend-door.rules.test.ts` does.
- [ ] **Step 6: Run** `npm run test:rules`. Expected: FAIL.
- [ ] **Step 7: Implement `projects.ts` and `content.ts`** (`createProjects(pb)`, `createContent(pb)`; filters with `pb.filter` and bound parameters; `update` builds a `GuardedIO` from `getOne` and a `PATCH` that sends `{ ...body, version }`, mapping errors through `toBackendError`). Wire into `createBackend` and `index.ts`.
- [ ] **Step 8: Run** `npm run test:rules` and `npm run test:unit`. Expected: PASS. **Close checkpoint 7B** (commit `feat: projects and content in the backend door`).

## Checkpoint 7C: Live changes

- [ ] **Step 9: Write the failing tests** C11 and C12 in the same file. Wait for events with a promise that resolves on the expected event (no fixed sleeps); for "receives nothing", first make a control edit in the outsider's own project and wait for it (catalogue `vacuous-absence`).
- [ ] **Step 10: Implement `realtime.ts`** and `content.subscribe`. Run `npm run test:rules`. Expected: PASS.
- [ ] **Step 11: Document** `backend.projects` and `backend.content` in `docs/developer/backend.md`: the types, that `update` retries 409 by itself and when it gives up, that `load` includes trashed records, and that missed events are not replayed (Plan 4). **Close checkpoint 7C** (commit `feat: live content changes`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | records map both ways | unit | a `nodes` record with `deleted_at` set; a `script_lines` record | `deleted: true`; `sortOrder` from `sort_order`, `character` `''` when missing | frontend/src/backend/content-mappers.test.ts :: records map to editor types |
| C2 | update bodies carry only the changed keys | unit | `toUpdateBody('nodes', { x: 5 })`; `({ deleted: true })`; `({ deleted: false })`; `toUpdateBody('projects', { startNodeId: null })` | `{ x: 5 }`; `deleted_at` an ISO time; `''`; `{ start_node: '' }` | frontend/src/backend/content-mappers.test.ts :: update bodies carry only the changed fields |
| C3 | create bodies keep the id and never the version | unit | `toCreateBody('connections', c)` | has `id`, `from_node`, `to_node`, `label`, `project`; no `version` | frontend/src/backend/content-mappers.test.ts :: create bodies keep the client id and drop the version |
| C4 | a 409 is retried with the fresh version | unit | first write rejects `conflict`, read gives version 7 | second write gets the same body and version 7; result returned | frontend/src/backend/guarded.test.ts :: a conflict is retried with the fresh version and the same fields |
| C5 | retries are bounded | unit | every write rejects `conflict` | exactly 20 writes, rejects `conflict` with `TOO_BUSY` | frontend/src/backend/guarded.test.ts :: it gives up after twenty conflicts |
| C6 | other errors are not retried | unit | write rejects `forbidden`; read rejects `not-found` after a conflict | one write, `forbidden` rethrown; `not-found` rethrown | frontend/src/backend/guarded.test.ts :: errors other than a conflict are not retried |
| C7 | project list and create | rules | member creates `Story`; outsider lists the team | creator's list has it with `deleted: false`; outsider's list is empty | tests/rules/content-door.rules.test.ts :: projects are listed for members only |
| C8 | load returns the whole project | rules | create a chapter, two nodes, a line, a cue, a connection, then `load` | all present with editor types; project has `startNodeId` of the first node | tests/rules/content-door.rules.test.ts :: load returns the whole project |
| C9 | two doors editing one node both win | rules | door A updates `title` and door B updates `x` with the same base version at once | both saved, no error thrown to either | tests/rules/content-door.rules.test.ts :: two people editing one node both keep their change |
| C10 | outsiders are refused by the door | rules | outsider door `load`, `update`, `create` in the project | reject with kind `not-found` or `forbidden` | tests/rules/content-door.rules.test.ts :: the door refuses outsiders |
| C11 | a teammate's change arrives live | rules | A subscribes; B renames a node, trashes a chapter, deletes a line | A gets `update`, `update` (`deleted: true`), `delete` events with mapped records | tests/rules/content-door.rules.test.ts :: a teammate's changes arrive as events |
| C12 | events stay inside the project | rules | outsider subscribes to the project; their own control edit arrives; B edits the project | outsider receives the control event only | tests/rules/content-door.rules.test.ts :: an outsider receives no events of the project |
### Probes
**Probe folder:** `tests/probes/2026-11-14-editor-core/task-7/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/backend/guarded.ts | `attempt <= MAX_SAVE_TRIES` | `attempt <= MAX_SAVE_TRIES + 1` | frontend/src/backend/guarded.test.ts |
| B2 | frontend/src/backend/guarded.ts | `if (error.kind !== 'conflict') throw error` | `if (false) throw error` | frontend/src/backend/guarded.test.ts |
| B3 | frontend/src/backend/content-mappers.ts | `deleted_at: changes.deleted ? new Date().toISOString() : ''` | `deleted_at: changes.deleted ? '' : new Date().toISOString()` | frontend/src/backend/content-mappers.test.ts |
### Flow
none (no screen yet)
### Evidence
The full output of `npm run check:task` and the failing run of each break.
