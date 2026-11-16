# Task 1: The upload checks

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Checkpoint 1A tier:** local
**Depends on:** Plan 3 (nothing of it is used; the dependency is the branch)

Every decision about an upload, as pure functions the hook calls (backend.md: "keep decisions pure and test them"): which type the first bytes show (D7), which type the name claims, the size limit per kind, the quota with the admin's override, and the exact message for each refusal (D2). Security.md section 5 lists "malicious upload" as a planned test; these unit tests are its first half.

**Files:**
- Create: `backend/pb_hooks/lib/media-check.js`, `tests/hooks/media-check.unit.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces, `backend/pb_hooks/lib/media-check.js` (CommonJS, `module.exports`):

```js
// Types are the lower-case names used in system_storage.allowed_types.
const TYPES = ["wav", "mp3", "mov", "mp4", "jpeg", "png"]          // also the display order of the "Allowed:" list
const MIB = 1048576
function extensionType(fileName)   // "a.JPG " -> "jpeg", ".jpeg" -> "jpeg", ".wav" -> "wav", ".mp4" -> "mp4", no or unknown extension -> null
function quotaFor(defaultBytes, overrideBytes)   // overrideBytes > 0 ? overrideBytes : defaultBytes
function formatBytes(bytes)        // < 1 MiB: whole KB rounded up ("12 KB", 0 -> "0 KB"); < 1 GiB: "200.0 MB"; else "1.5 GB" (1024-based)
function detectType(head)          // head: array of byte numbers (at least the first 16 when the file has them); one of TYPES or null (D7)
function kindOf(type)              // wav, mp3 -> "audio"; mov, mp4 -> "video"; jpeg, png -> "image"
function checkUpload(input)
// input: { fileName, size, head, allowedTypes: string[], maxMb: { audio, video, image }, usedBytes, quotaBytes }
// -> { ok: true, type, kind }  or  { ok: false, code, message }
// order: 1. extension type null or not allowed -> media_type_not_allowed
//        2. detected null, or not the extension's type (mov and mp4 match each other) -> media_not_real
//        3. detected type not allowed -> media_type_not_allowed
//        4. size > maxMb[kind] * MIB -> media_too_large
//        5. usedBytes + size > quotaBytes -> media_over_quota
// messages: the router's exact copy
module.exports = { TYPES, MIB, extensionType, quotaFor, formatBytes, detectType, kindOf, checkUpload }
```

**If interrupted:** nothing leaves state outside the working tree.

## Sized for the local model
**May touch:** `backend/pb_hooks/lib/media-check.js`, `tests/hooks/media-check.unit.test.ts` (exhaustive: no other file)
**Must not change:** the names and signatures in the Interfaces block; checkpoint 1A writes only `TYPES`, `MIB`, `extensionType`, `quotaFor` and `formatBytes`
Stop and report if you need to touch anything else.
**Model server:** run `npm run ping:model` first; if it says NOT answering, do not start the run (see [the runbook](../../../developer/local-model-runbook.md))
**Checkpoint given:** Checkpoint 1A only

## Checkpoint 1A: Names, quota and sizes (local)

- [ ] **Step 1: Write the failing tests** C3 and C4 in `tests/hooks/media-check.unit.test.ts` (load the helper with `createRequire(import.meta.url)`, as `tests/hooks/lockout.unit.test.ts` does).
- [ ] **Step 2: Run** `npx vitest run --project unit tests/hooks/media-check.unit.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `TYPES`, `MIB`, `extensionType`, `quotaFor`, `formatBytes`. The override rule is the line `return overrideBytes > 0 ? overrideBytes : defaultBytes` (B1).
- [ ] **Step 4: Run** it. Expected: PASS. **Close checkpoint 1A** (commit `feat: upload name, quota and size helpers`).

## Checkpoint 1B: Bytes and the whole check (mid)

- [ ] **Step 5: Write the failing tests** C1, C2 and C5 to C7.
- [ ] **Step 6: Run** the file. Expected: the new tests FAIL.
- [ ] **Step 7: Implement** `detectType`, `kindOf`, `checkUpload`. Write these decisions as single lines: the MP3 frame sync `if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return "mp3"` (B2); the family test `const sameFamily = detected === claimed || (VIDEO.includes(detected) && VIDEO.includes(claimed))` (B3); the size test `if (input.size > input.maxMb[kind] * MIB)` (B4); the quota test `if (input.usedBytes + input.size > input.quotaBytes)` (B5). The JPEG test must come before the MP3 test, because `FF D8` would otherwise need the frame-sync rule to exclude it (it does: `D8 & E0` is `C0`, but keep the order anyway).
- [ ] **Step 8: Run** it. Expected: PASS. **Close checkpoint 1B** (commit `feat: upload type detection and checks`).

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | magic bytes | unit | PNG signature; `FF D8 FF E0`; `RIFF????WAVE`; `ID3`; `FF FB`; `FF F3`; `????ftypqt  `; `????ftypisom`; `????ftypmp42`; `????moov`; `????wide` | png, jpeg, wav, mp3, mp3, mp3, mov, mp4, mp4, mov, mov | tests/hooks/media-check.unit.test.ts :: each allowed type is known by its first bytes |
| C2 | not media | unit | `<!doctype html>`; `%PDF-`; 16 zero bytes; `RIFF????AVI `; `FF D8` alone (2 bytes); `[]`; `GIF89a`; `FF 00` | `null` each | tests/hooks/media-check.unit.test.ts :: other files and short files are not media |
| C3 | names | unit | `a.JPG `, `x.jpeg`, `song.Mp3`, `clip.mov`, `noext`, `evil.png.html`, `.wav`, `a.gif` | jpeg, jpeg, mp3, mov, null, null, wav, null | tests/hooks/media-check.unit.test.ts :: a file name's extension gives its claimed type |
| C4 | quota and sizes | unit | `quotaFor(2147483648, 0)`, `(2147483648, 5000)`; `formatBytes` of 0, 12000, 1048575, 1048576, 209715200, 1610612736 | 2147483648, 5000; `0 KB`, `12 KB`, `1024 KB`, `1.0 MB`, `200.0 MB`, `1.5 GB` | tests/hooks/media-check.unit.test.ts :: the quota uses the override and sizes read well |
| C5 | renamed files refused | unit | PNG bytes named `song.mp3`; HTML named `photo.jpg`; zeros named `a.wav`; real JPEG named `a.jpg`; MP4 bytes named `clip.mov` | `media_not_real` `This file is not a real MP3 file.`; `… real JPEG file.`; `… real WAV file.`; ok jpeg image; ok mp4 video | tests/hooks/media-check.unit.test.ts :: a file whose bytes do not match its name is refused |
| C6 | allowed list | unit | `a.gif` (any bytes); `a.png` with `allowedTypes` without png; `clip.mov` with MP4 bytes and `allowedTypes` without mp4 | `media_type_not_allowed` `This file type is not allowed. Allowed: WAV, MP3, MOV, MP4, JPEG, PNG.`; `… Allowed: WAV, MP3, MOV, MP4, JPEG.`; `… Allowed: WAV, MP3, MOV, JPEG, PNG.` | tests/hooks/media-check.unit.test.ts :: only types on the admin's list are allowed |
| C7 | size and quota limits | unit | video exactly 200 MiB with max 200; one byte more; image 50 MiB + 1 with image max 50 and video max 200; quota 2147483648, used 2040109466 (107374182 bytes free), file 200 MiB; exactly filling the quota | ok; `media_too_large` `This video file is larger than the 200 MB limit.`; `… image file is larger than the 50 MB limit.`; `media_over_quota` `Not enough storage: this file is 200.0 MB and you have 102.4 MB of 2.0 GB left. Nothing was deleted.`; ok | tests/hooks/media-check.unit.test.ts :: size and quota limits refuse with the limit named |
### Probes
**Probe folder:** `tests/probes/2026-11-16-media-upload/task-1/`
### Breaks
| ID | File | Find | Replace | Tests |
|---|---|---|---|---|
| B1 | backend/pb_hooks/lib/media-check.js | `return overrideBytes > 0 ? overrideBytes : defaultBytes` | `return defaultBytes` | tests/hooks/media-check.unit.test.ts |
| B2 | backend/pb_hooks/lib/media-check.js | `if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return "mp3"` | `if (head[0] === 0xff) return "mp3"` | tests/hooks/media-check.unit.test.ts |
| B3 | backend/pb_hooks/lib/media-check.js | `const sameFamily = detected === claimed \|\| (VIDEO.includes(detected) && VIDEO.includes(claimed))` | `const sameFamily = detected !== null` | tests/hooks/media-check.unit.test.ts |
| B4 | backend/pb_hooks/lib/media-check.js | `if (input.size > input.maxMb[kind] * MIB)` | `if (input.size > input.maxMb.video * MIB)` | tests/hooks/media-check.unit.test.ts |
| B5 | backend/pb_hooks/lib/media-check.js | `if (input.usedBytes + input.size > input.quotaBytes)` | `if (input.usedBytes + input.size >= input.quotaBytes)` | tests/hooks/media-check.unit.test.ts |
### Flow
none
### Evidence
The full output of `npm run check:task` and the failing run of each break.
