# Task 1: The pure Story and Session

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** local
**Depends on:** none

**Files:**
- Create: `frontend/src/features/player/story.ts`, `frontend/src/features/player/story.test.ts`, `frontend/src/features/player/session.ts`, `frontend/src/features/player/session.test.ts`

**Interfaces:**
- Consumes: `ContentState`, `liveNodes`, `linesOf`, `fromContent` from `frontend/src/features/editor/model/state.ts`; `effectiveStart` from `.../model/markers.ts`; `choicesOf` from `.../model/choices.ts`; `MediaKind` from `frontend/src/backend/media-types.ts`; the fixtures `chapter`, `node`, `line`, `cue`, `connection`, `content` from `.../model/fixtures.ts`.
- Produces in `story.ts`:
  - `interface StoryMediaInput { id: string; nodeId: string; title: string; kind: MediaKind }`
  - `interface PlayLine { character: string; text: string }` (`character` is `''` for action or narration)
  - `interface PlayMedia { id: string; title: string; kind: MediaKind }`
  - `interface PlayChoice { id: string; label: string; targetId: string | null }`
  - `interface PlayNode { id: string; title: string; chapterId: string; chapterTitle: string; lines: PlayLine[]; media: PlayMedia[]; choices: PlayChoice[] }`
  - `interface Story { projectName: string; startId: string | null; nodes: Record<string, PlayNode> }`
  - `buildStory(s: ContentState, media: StoryMediaInput[]): Story`
- Produces in `session.ts`:
  - `interface Step { nodeId: string; viaChoiceId: string | null }` and `interface Session { steps: Step[] }` (`steps[0]` is the start and has `viaChoiceId: null`; a session is never changed in place)
  - `interface Screen { node: PlayNode; index: number; showChapter: boolean; isEnd: boolean; canGoBack: boolean }`
  - `interface HistoryEntry { text: string; chapterTitle: string; current: boolean }`
  - `startSession(story: Story): Session | null`
  - `choose(story: Story, session: Session, choiceId: string): Session | null`
  - `back(session: Session): Session`
  - `screenOf(story: Story, session: Session): Screen`
  - `historyOf(story: Story, session: Session): HistoryEntry[]`

**If interrupted:** nothing leaves state outside the working tree.

## Sized for the local model
**May touch:** `frontend/src/features/player/story.ts`, `frontend/src/features/player/story.test.ts`, `frontend/src/features/player/session.ts`, `frontend/src/features/player/session.test.ts` (exhaustive: no other file)
**Must not change:** the exported names and signatures in Interfaces above, every existing file and every existing test
Stop and report if you need to touch anything else.
**Model server:** run `npm run ping:model` first; if it says NOT answering, do not start the run (see [the runbook](../../../developer/local-model-runbook.md))
**Checkpoint given:** one checkpoint per run: Checkpoint 1A first, then Checkpoint 1B in a second run

## Checkpoint 1A: the Story

- [ ] **Step 1: Write failing tests** `story.test.ts` (C1, C2), building states with `fromContent(content({...}))` and the fixtures. Give each connection a `created` of `'1'`, `'2'` and so on so the order is the order written.
- [ ] **Step 2: Run, expect FAIL**: `npx vitest run frontend/src/features/player/story.test.ts`.
- [ ] **Step 3: Implement `buildStory(s, media)` in `story.ts`.** Only live nodes (`liveNodes(s)`). For each: `title` trimmed, `Untitled` when empty; `chapterTitle` the chapter's title trimmed, `Untitled` when empty; `lines` from `linesOf`, each `{ character: l.character.trim(), text: l.text }`, keeping a line only when it has a name or text. Write this line exactly (a break targets it): `.filter((l) => l.character.trim() !== '' || l.text.trim() !== '')`. `media` is the entries of `media` whose `nodeId` is the node, in the given order, as `{ id, title, kind }`. `choices` are `choicesOf(s, id)` mapped to `{ id, label, targetId: c.toNodeId }`. Write the label line exactly: `const label = c.label.trim() !== '' ? c.label.trim() : titleOf(c.toNodeId)`, where `titleOf(targetId: string | null): string` is the target node's trimmed title, and `Untitled` when there is no target or the title is empty. Cues are never read. `projectName` is the project's name (`''` with no project) and `startId` is `effectiveStart(s)`.
- [ ] **Step 4: Run, expect PASS. Close the checkpoint (one commit)** `feat: build the story a player sees`.

## Checkpoint 1B: the Session

- [ ] **Step 1: Write failing tests** `session.test.ts` (C3 to C9) with `Story` literals written in the test file (a small helper `story(nodes)` is fine), not built by `buildStory`.
- [ ] **Step 2: Run, expect FAIL**: `npx vitest run frontend/src/features/player/session.test.ts`.
- [ ] **Step 3: Implement `session.ts`.** Write these lines exactly (breaks target them):
  - in `startSession`: returns `null` when `story.startId` is `null` or names no node of `story.nodes`; else `{ steps: [{ nodeId: story.startId, viaChoiceId: null }] }`.
  - in `choose`: finds the choice among the current node's `choices` by id; returns `null` when there is none, when its `targetId` is `null` or when the target is not in `story.nodes`; else `{ steps: [...session.steps, { nodeId: choice.targetId, viaChoiceId: choiceId }] }`.
  - in `back`: `steps: session.steps.length > 1 ? session.steps.slice(0, -1) : session.steps` inside a new session object.
  - in `screenOf`: `const isEnd = node.choices.every((c) => c.targetId === null)` and `const showChapter = index === 0 || prev.chapterId !== node.chapterId`, where `index` is the last step's index, `node` its node and `prev` the node of the step before it; `canGoBack` is `index > 0`.
  - `historyOf` gives one entry per step: `text` is the node's title for step 0 and `<label of the choice taken> → <node title>` after it (the choice is found by `viaChoiceId` among the previous node's choices), `chapterTitle` the node's chapter title, `current` true only for the last step.
- [ ] **Step 4: Run, expect PASS. Close the checkpoint (one commit)** `feat: the path session of Player Mode`.

## Test plan

### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | the story holds live nodes with cleaned titles, ordered lines and labelled choices | unit | project `Story` with start `n1`; chapter `c1` titled ` One `, chapter `c2` in the trash; nodes `n1` titled `  Gate ` and `n2` titled `` in `c1`, `n3` in `c2`, `n4` trashed in `c1`; lines of `n1`: `l1` (order 2, `Mara`, `Second`) and `l2` (order 1, `Mara`, `First`); connections in order `k1` n1 to n2 labelled ` Open `, `k2` n1 to nothing labelled ``, `k3` n1 to `n4` labelled `Gone`, `k4` n2 to n1 labelled `   `. A second state is the same but its start node is `n3` | the nodes are `n1`, `n2` only; titles `Gate` and `Untitled`; `n1.chapterTitle` is `One`; line texts `First`, `Second`; `n1.choices` is `[{ id: 'k1', label: 'Open', targetId: 'n2' }, { id: 'k2', label: 'Untitled', targetId: null }]`; `n2.choices` is `[{ id: 'k4', label: 'Gate', targetId: 'n1' }]`; `projectName` `Story`, `startId` `n1`; in the second state `startId` is `null` | frontend/src/features/player/story.test.ts :: the story holds live nodes, ordered lines and labelled choices |
| C2 | blank lines are dropped, cues never appear, media attaches by node | unit | node `n1` with lines `{ '', '' }`, `{ '  ', ' ' }`, `{ '', 'He waits.' }`, `{ ' Mara ', '' }` and two cues; media inputs `a` (node n1), `b` (node n2), `c` (node n1) | `n1.lines` is `[{ character: '', text: 'He waits.' }, { character: 'Mara', text: '' }]`; `'cues' in n1` is `false`; `n1.media` ids `a`, `c` in that order; `n2.media` ids `b` | frontend/src/features/player/story.test.ts :: blank lines and cues stay out and media follows its node |
| C3 | no start, nothing to play | unit | `startSession` of a story with `startId: null`; of one whose `startId` is `x` with no such node; of a normal one with start `n1` | `null`; `null`; `{ steps: [{ nodeId: 'n1', viaChoiceId: null }] }` | frontend/src/features/player/session.test.ts :: a session starts only at a real start node |
| C4 | a choice that leads nowhere does not move | unit | node `n1` with choices `k1` to `n2`, `k2` with no target, `k3` to `ghost` (not in the story); `choose` with `k1`, `k2`, `k3`, `nope`; the session is read again afterwards | `k1`: steps `n1` then `n2` (the second with `viaChoiceId: 'k1'`); `null` for `k2`, `k3` and `nope`; the first session still has one step | frontend/src/features/player/session.test.ts :: an empty or unknown choice returns null and changes nothing |
| C5 | the chapter shows at the start and when it changes | unit | nodes `n1`, `n2` in chapter `c1`, `n3` in `c2`; path `n1`, `n2`, `n3`; then `back` once | `showChapter` per step `true`, `false`, `true`; after `back` the last screen is `n2` with `showChapter` `false` | frontend/src/features/player/session.test.ts :: the chapter name shows when it changes |
| C6 | loops add steps and nothing else | unit | `n1` with a choice `k1` to itself, chosen three times; `n1` and `n2` with choices to each other, chosen six times | four steps all on `n1`, each after the first with `viaChoiceId: 'k1'`; seven steps alternating `n1`, `n2`, the last on `n1`; `showChapter` is `false` on every step after step 0 | frontend/src/features/player/session.test.ts :: a loop is just more steps |
| C7 | back undoes exactly one step, restart starts again | unit | a path of three steps, `back` once and twice more; `back` of a one-step session; `startSession` after moving | two steps equal to the first two; then one step, and a further `back` still gives one step (`canGoBack` `false`); the earlier sessions are unchanged; `startSession` gives one step | frontend/src/features/player/session.test.ts :: back removes one step and never goes below the start |
| C8 | where a path ends | unit | a node with no choices; one with only empty choices; one with a linked and an empty choice | `isEnd` is `true`; `true`; `false` | frontend/src/features/player/session.test.ts :: the end is a node with no linked choice |
| C9 | the history reads as the path | unit | path `Gate` (chapter `One`), choice `Open it` to `Door`, choice `Knock` to `Garden` (chapter `Two`); then `back` | `['Gate', 'Open it → Door', 'Knock → Garden']`, chapter titles `One`, `One`, `Two`, only the last `current`; after `back` two entries, the last `current` | frontend/src/features/player/session.test.ts :: the history lists the path with the choices taken |

### Probes
**Probe folder:** `tests/probes/2026-11-26-player-mode/task-1/`

### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/player/story.ts | `c.label.trim() !== ''` | `c.label !== ''` | frontend/src/features/player/story.test.ts |
| B2 | frontend/src/features/player/story.ts | `.filter((l) => l.character.trim() !== '' \|\| l.text.trim() !== '')` | `.filter(() => true)` | frontend/src/features/player/story.test.ts |
| B3 | frontend/src/features/player/session.ts | `node.choices.every((c) => c.targetId === null)` | `node.choices.some((c) => c.targetId === null)` | frontend/src/features/player/session.test.ts |
| B4 | frontend/src/features/player/session.ts | `prev.chapterId !== node.chapterId` | `prev.chapterId === node.chapterId` | frontend/src/features/player/session.test.ts |
| B5 | frontend/src/features/player/session.ts | `session.steps.slice(0, -1)` | `session.steps.slice(0, -2)` | frontend/src/features/player/session.test.ts |
| B6 | frontend/src/features/player/session.ts | `viaChoiceId: choiceId` | `viaChoiceId: null` | frontend/src/features/player/session.test.ts |

### Flow
none

### Evidence
The full output of `npm run check:task` and the failing run of each break.
