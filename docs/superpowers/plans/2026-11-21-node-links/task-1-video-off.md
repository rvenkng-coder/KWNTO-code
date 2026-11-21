# Task 1: Videos off

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** strong
**Depends on:** none

**Files:**
- Create: `backend/pb_migrations/1794400000_video_off.js`
- Modify: `frontend/src/features/editor/media/uploadCheck.ts`, `frontend/src/features/editor/media/uploadCheck.test.ts`, `frontend/src/features/editor/media/MediaSection.tsx`, `tests/rules/system_storage.rules.test.ts`, `tests/rules/media.rules.test.ts`, `e2e/editor-media.spec.ts`, `docs/admin/settings.md`, `docs/user/editor.md`
- Create (rules tests): `tests/rules/video-off.rules.test.ts`

**Interfaces:**
- Produces: `export function acceptFor(allowedTypes: string[] | null): string` in `uploadCheck.ts`. Maps each allowed type, in the order `['wav', 'mp3', 'mov', 'mp4', 'jpeg', 'png']`, to its extensions and joins with `,`: `wav` to `.wav`, `mp3` to `.mp3`, `mov` to `.mov`, `mp4` to `.mp4`, `jpeg` to `.jpg,.jpeg`, `png` to `.png`. `null` and `[]` give `''`.

**If interrupted:** the migration has a `down`; reverting the commit restores video.

## Checkpoint 1A: the picker follows the setting

- [ ] **Step 1: Write failing tests** in `uploadCheck.test.ts` (titles in the Test plan: C1, C2, C3).
- [ ] **Step 2: Run, expect FAIL**: `npx vitest run frontend/src/features/editor/media/uploadCheck.test.ts` (acceptFor not defined).
- [ ] **Step 3: Implement `acceptFor`** in `uploadCheck.ts`. Keep the existing `ORDERED_TYPES` constant line exactly as it is (a break targets it) and write the mapping as an object literal that contains the exact text `jpeg: '.jpg,.jpeg'`. In `MediaSection.tsx` replace the hard-coded `accept=".wav,.mp3,.mov,.mp4,.jpg,.jpeg,.png"` with `accept={acceptFor(storage?.allowedTypes ?? null)}` (the component already reads `storage`).
- [ ] **Step 4: Run, expect PASS. Commit** `feat: the file picker follows the allowed types`.

## Checkpoint 1B: videos off in the data, tests updated

- [ ] **Step 1: Write failing tests**: `tests/rules/video-off.rules.test.ts` (C5, C7) and the three approved edits of D3:
  - `system_storage.rules.test.ts`: the expected `allowed_types` becomes `['wav', 'mp3', 'jpeg', 'png']`; update the comment above it to say video is off by decision (plan 2026-11-21-node-links D1).
  - `media.rules.test.ts` (the storage route test near the end): `expect(data.allowedTypes).toEqual(['wav', 'mp3', 'jpeg', 'png'])`.
  - `e2e/editor-media.spec.ts`, test `audio and video files get players`: rename it `audio files get players and video is refused`; keep the mp3 part and the `audio[controls]` assertions; replace the mp4 part with: set the `clip.mp4` file, expect `alertBox(page)` to have text `This file type is not allowed. Allowed: WAV, MP3, JPEG, PNG.`, expect `mediaItems(page)` to have count 1 and `video[controls]` to have count 0; and assert `await input.getAttribute('accept')` contains neither `mp4` nor `mov`. Do not touch any other test.
- [ ] **Step 2: Run, expect FAIL** (`npm run test:rules` for the rules files; the e2e after the migration exists). C6 is an existing test whose assertion changes (D3); its title stays.
- [ ] **Step 3: Write `1794400000_video_off.js`**: follow how `1794360000_system_settings.js` and `1794380100_media_team_quota.js` read and save the single `system_storage` row. `up` removes `mov` and `mp4` from `allowed_types` (keep the other entries and their order); `down` adds `mov` and `mp4` back in the original order (`['wav', 'mp3', 'mov', 'mp4', 'jpeg', 'png']` filtered to what the row lacks, then re-sorted into that order). Update `docs/admin/settings.md` (the `allowed_types` row: new default and the sentence "Video is off by decision; add `mov` and `mp4` here to switch it back on") and `docs/user/editor.md` (line "Allowed types" and the Media bullets: audio and images only; say a video should be added as a link, which the next tasks provide).
- [ ] **Step 4: Run, expect PASS**: `npm run test:rules`, `npm run test:unit`, `npm run test:e2e -- e2e/editor-media.spec.ts`. If any other test or a sealed probe fails because video is off, stop and report it (D3). Close the checkpoint (one commit).

## Test plan

### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | all six types give the full accept list in order | unit | `acceptFor(['wav','mp3','mov','mp4','jpeg','png'])` | `.wav,.mp3,.mov,.mp4,.jpg,.jpeg,.png` | frontend/src/features/editor/media/uploadCheck.test.ts :: acceptFor lists every allowed extension |
| C2 | video off gives no video extensions | unit | `acceptFor(['wav','mp3','jpeg','png'])` | `.wav,.mp3,.jpg,.jpeg,.png` | frontend/src/features/editor/media/uploadCheck.test.ts :: acceptFor leaves out a type that is off |
| C3 | no information yet gives no filter | unit | `acceptFor(null)` and `acceptFor([])` | `''` for both | frontend/src/features/editor/media/uploadCheck.test.ts :: acceptFor gives no filter without a list |
| C4 | a new install starts with video off | rules | read `system_storage` | `allowed_types` equals `['wav','mp3','jpeg','png']` | tests/rules/system_storage.rules.test.ts :: system_storage starts with the spec defaults |
| C5 | the server refuses mp4 and mov | rules | a member uploads `clip.mp4` then `clip.mov` (real bytes from `sampleBytes`) | both 400 with message `This file type is not allowed. Allowed: WAV, MP3, JPEG, PNG.`; no media row exists | tests/rules/video-off.rules.test.ts :: the server refuses mp4 and mov |
| C6 | the storage route reports the new list | rules | the lead reads `/api/kwnto/storage` | `allowedTypes` equals `['wav','mp3','jpeg','png']` | tests/rules/media.rules.test.ts :: the storage route shows the lead's usage to the team and nobody else |
| C7 | the admin can switch video back on | rules | admin sets `allowed_types` to the six, member uploads `clip.mp4`, admin restores the four | upload is 200 with `kind` `video`; afterwards mp4 is refused again | tests/rules/video-off.rules.test.ts :: the admin can switch video back on |
| C8 | the picker no longer offers video and refuses a chosen mp4 | e2e | open the media section; set `clip.mp4` | `accept` has no `mp4` or `mov`; the clear message shows; no item added | e2e/editor-media.spec.ts :: audio files get players and video is refused |

### Probes
**Probe folder:** `tests/probes/2026-11-21-node-links/task-1/`

### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | frontend/src/features/editor/media/uploadCheck.ts | `const ORDERED_TYPES = ['wav', 'mp3', 'mov', 'mp4', 'jpeg', 'png']` | `const ORDERED_TYPES = ['wav', 'mp3', 'mov', 'jpeg', 'png']` | frontend/src/features/editor/media/uploadCheck.test.ts |
| B2 | frontend/src/features/editor/media/uploadCheck.ts | `jpeg: '.jpg,.jpeg'` | `jpeg: '.jpeg'` | frontend/src/features/editor/media/uploadCheck.test.ts |

### Flow
none

### Evidence
The full output of `npm run check:task` and the failing run of each break.
