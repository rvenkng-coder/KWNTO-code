# Task 3: The media door

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** Task 2

The browser's only way to media (engineering 2: one door): list, upload, delete, the caller's storage, file URLs with a fresh token (D5) and live changes (D11). It also adds the browser's early check: a quick refusal with the server's exact words before a 200 MB file is sent for nothing. The server stays the judge.

**Files:**
- Create: `frontend/src/backend/media-types.ts`, `frontend/src/backend/media.ts`, `frontend/src/backend/media.test.ts`, `frontend/src/backend/file-tokens.ts`, `frontend/src/backend/file-tokens.test.ts`, `frontend/src/features/editor/media/uploadCheck.ts`, `frontend/src/features/editor/media/uploadCheck.test.ts`, `tests/rules/media-door.rules.test.ts`
- Modify: `frontend/src/backend/client.ts` and `frontend/src/backend/index.ts` (`media` on `Backend`; export the types), `docs/developer/backend.md` ("The backend door": `backend.media`)

**Interfaces:**
- Consumes: the `media` collection, the D2 refusal body and `GET /api/kwnto/storage` (Task 2); `toBackendError`, `BackendError` (Plan 2); `PNG_1PX`, `sampleBytes`, `setQuotaOverride` (`tests/rules/helpers/media.ts`, Task 2).
- Produces, `media-types.ts`:

```ts
export type MediaKind = 'audio' | 'video' | 'image'
export interface Media { id: string; projectId: string; nodeId: string; uploaderId: string; title: string; kind: MediaKind; sizeBytes: number; fileName: string; created: string }
export interface StorageInfo { usedBytes: number; quotaBytes: number; maxBytes: Record<MediaKind, number>; allowedTypes: string[] }
export interface MediaEvent { action: 'create' | 'delete'; record: Media }
```

- Produces, `backend.media` (`media.ts`):

```ts
list(projectId: string): Promise<Media[]>                       // every row of the project, oldest first
upload(projectId: string, nodeId: string, file: File): Promise<Media>   // sends uploader = the signed-in user; a refusal is BackendError 'invalid' with fields.file = the server's message
remove(id: string): Promise<void>
storage(): Promise<StorageInfo>
fileUrl(media: Media, token: string, thumb?: '100x100'): string // pb.files.getURL with { token, thumb }
fileToken(): Promise<string>                                    // cached by createFileTokens
subscribe(projectId: string, onEvent: (e: MediaEvent) => void): Promise<() => Promise<void>>
export function fromMediaRecord(row: Record<string, unknown>): Media   // `file` -> fileName, `size_bytes` -> sizeBytes, ...
```

- Produces, `file-tokens.ts`: `export const TOKEN_REUSE_MS = 90_000`; `export function createFileTokens(fetch: () => Promise<string>, now: () => number): { get(): Promise<string> }` (reuses a token younger than `TOKEN_REUSE_MS`; parallel `get` calls share one fetch; a failed fetch is not cached).
- Produces, `features/editor/media/uploadCheck.ts`:

```ts
export function formatSize(bytes: number): string               // same results as Task 1's formatBytes
export function earlyProblem(file: { name: string; size: number }, info: StorageInfo): string | null
// the router's copy for "type not allowed" (by extension only), "too large" and "over quota"; null when the server should judge
// (the bytes check is the server's alone)
```

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 3A: Mapping, tokens and the early check (unit)

- [x] **Step 1: Write the failing tests** C1 to C3.
- [x] **Step 2: Run** `npx vitest run --project unit frontend/src/backend/media.test.ts frontend/src/backend/file-tokens.test.ts frontend/src/features/editor/media/uploadCheck.test.ts`. Expected: FAIL.
- [x] **Step 3: Implement** `media-types.ts`, `fromMediaRecord`, `file-tokens.ts`, `uploadCheck.ts`. Write the reuse test as `if (cached !== null && now() - cached.at < TOKEN_REUSE_MS) return cached.token` (B1) and the quota test as `if (info.usedBytes + file.size > info.quotaBytes)` (B2).
- [x] **Step 4: Run** them. Expected: PASS. **Close checkpoint 3A** (commit `feat: media types, file tokens and the early upload check`).

## Checkpoint 3B: The door against a live PocketBase

- [x] **Step 5: Write the failing tests** C4 to C7 in `tests/rules/media-door.rules.test.ts`, through `createBackend(PB_URL)` (a `File` made from `sampleBytes`; Node 22 has `File`).
- [x] **Step 6: Run** `npm run test:rules -- tests/rules/media-door.rules.test.ts`. Expected: FAIL (`backend.media` undefined).
- [x] **Step 7: Implement** `media.ts` and wire it into `createBackend` and the lazy `backend` in `index.ts`. `subscribe` filters by project as `realtime.ts` does.
- [x] **Step 8: Run** `npm run test:rules` and `npm run test:unit`. Expected: PASS. Update `backend.md`. **Close checkpoint 3B** (commit `feat: the media door`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | mapping | unit | a record with `file`, `size_bytes`, `uploader`, `kind`, `title`, `node`, `project` | the `Media` fields; an unknown `kind` throws | frontend/src/backend/media.test.ts :: a media record maps to the editor's type |
| C2 | token reuse | unit | `get` twice within 89 s; once more at 91 s; two parallel `get` with no token; a fetch that fails, then `get` again | one fetch, then a second; parallel calls share one fetch; after the failure a new fetch is made | frontend/src/backend/file-tokens.test.ts :: a file token is reused for ninety seconds |
| C3 | early check | unit | `a.gif`; a 201 MiB `a.mp4` (video max 200 MiB); a 60 MB `a.png` with 50 MB free; a fine `a.png`; `formatSize` of 0, 12000, 209715200 | the type, size and quota messages of the router; `null`; `0 KB`, `12 KB`, `200.0 MB` | frontend/src/features/editor/media/uploadCheck.test.ts :: the browser refuses early with the server's words |
| C4 | upload and list | rules | member uploads `PNG_1PX` as `a.png` through the door; lists | a `Media` with `kind` image, `sizeBytes` 67, `title` `a.png`; the list has it; `fileUrl` with `fileToken()` fetches 67 bytes | tests/rules/media-door.rules.test.ts :: the door uploads, lists and serves a file |
| C5 | refusal reaches the screen words | rules | PNG bytes as `a.mp3`; over a 100-byte override | `BackendError` `invalid` with `fields.file` `This file is not a real MP3 file.`; then the over-quota message | tests/rules/media-door.rules.test.ts :: a refused upload says which limit it hit |
| C6 | storage and remove | rules | upload 67 bytes; `storage()`; `remove`; `storage()` | `usedBytes` 67 then 0 | tests/rules/media-door.rules.test.ts :: removing a file frees its space at once |
| C7 | live changes | rules | A subscribes to the project; teammate B uploads and then deletes; an outsider subscribed to the same project id | A gets `create` then `delete` with the `Media`; the outsider gets nothing from A's project, but does get the event of an upload in their own project (so silence is not a dead connection) | tests/rules/media-door.rules.test.ts :: teammates see uploads and deletes live and outsiders do not |
### Probes
**Probe folder:** `tests/probes/2026-11-16-media-upload/task-3/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/backend/file-tokens.ts | `if (cached !== null && now() - cached.at < TOKEN_REUSE_MS) return cached.token` | `if (cached !== null) return cached.token` | frontend/src/backend/file-tokens.test.ts |
| B2 | frontend/src/features/editor/media/uploadCheck.ts | `if (info.usedBytes + file.size > info.quotaBytes)` | `if (file.size > info.quotaBytes)` | frontend/src/features/editor/media/uploadCheck.test.ts |
### Flow
none
### Evidence
The full output of `npm run check:task` and the failing run of each break.
