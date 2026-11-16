# The editor: model and store

The editor's state is plain data with pure functions over it, plus one store that loads a project, applies edits at once, sends them through the backend door and applies teammates' live changes. Screens read and change content only through the store. Plan: [editor core](../superpowers/plans/2026-11-14-editor-core/README.md), Task 8.

## Where things are

| File (in `frontend/src/features/editor/`) | What |
|---|---|
| `model/ids.ts` | `newId()`: a 15-character `a-z0-9` id from `crypto.getRandomValues`. The browser makes every new record's id (undo re-creates a record with its id) |
| `model/sortOrder.ts` | Decimal sort order (decision D4): `sortOrderBetween`, `renumber`, `byOrder`, and `placeAt` and `insertAt` for moving and inserting in a list |
| `model/state.ts` | `ContentState` (records by id) and the "live" views over it |
| `model/remote.ts` | `applyRemote`: a teammate's change applied to the state |
| `store/editorStore.ts` | `editorStore`, `useEditor(selector)` |
| `model/fixtures.ts` | Record builders for tests only |

## The state

`ContentState` holds the open project, its settings, and the chapters, nodes, script lines, cues and connections **by id**, trashed ones included (undo and the trash need them). The views never mutate:

- `liveChapters`: not trashed, by `position` then id.
- `isLiveNode` / `liveNodes`: the node exists, is not trashed **and its chapter exists and is not trashed**. Trashing a chapter therefore hides its nodes without touching them.
- `liveConnections`: both ends are live nodes. A trashed node leaves no dangling edge.
- `linesOf` / `cuesOf`: of one node, by `sortOrder` then id.

## Sort order

Lines, cues and chapter tabs carry a decimal order. Inserting between two neighbours takes the midpoint; at an end it takes the neighbour plus or minus 1. When the midpoint is no longer strictly between the neighbours (after about 50 halvings in one gap) `sortOrderBetween` returns `null` and `placeAt` / `insertAt` answer with `{ kind: 'renumber', orders }`: the whole list as 1, 2, 3, ... The caller sends one update per record in that case.

## How an edit travels

1. A screen calls `update(kind, id, changes)` (or `create`, `remove`) on the store.
2. The store changes `content` at once and raises `saving`.
3. The door (`backend.content`) sends only the changed fields with the record's local `version` as the base. The server hook compares versions (decision 0002). On a 409 the door re-reads and retries by itself, up to 20 times.
4. On success the saved record replaces the local one **only if its version is higher**. On a refusal the fields of that edit go back to what they were (a later edit of another field stays) and `error` holds the message; the method resolves `false`.
5. The server's change event for our own save comes back through the subscription. Its version is not newer than the local copy, so `applyRemote` ignores it. A teammate's change has a higher version and is applied; a delete drops the record; an event of another project is ignored.

## Opening and closing

`open(projectId)` closes any open project and starts loading and subscribing **together**. Events that arrive before the load is applied wait in a buffer and are applied after it (the version check drops stale ones). Every `open` and `close` bumps a token; a load or subscription that finishes for an older token is dropped and its subscription closed, so a slow project A can never overwrite project B. A failed load or subscribe gives `status: 'error'` and closes whatever did open.

Missed events after a lost connection are not recovered here (that is Plan 4).
