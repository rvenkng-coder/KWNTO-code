# Task 5: The cleaner look

Part of the [plan](README.md). **Read the router first:** its Global Constraints apply to every step here.

**Model tier:** mid
**Depends on:** Tasks 2, 3 and 4

This task gives the editor the prototype's cleaner look (design goal 4), through theme tokens only, in light and dark. It makes no change to behaviour.

**Files:**
- Modify:
  - `frontend/src/index.css`: new tokens and shared classes.
  - `frontend/src/features/editor/canvas/NodeCard.tsx`
  - `frontend/src/features/editor/panel/*.tsx`: section headings and buttons only.
  - `frontend/src/features/editor/EditorScreen.tsx`: panel surfaces.
  - `docs/developer/styling.md`: list the new tokens and classes.
- Create:
  - `frontend/src/features/editor/panel/SectionLabel.tsx`
  - `e2e/editor-look.spec.ts`

**Interfaces:**
- Produces, `index.css`:
  - **Tokens,** defined for light and again for dark:
    - `--radius-lg` (about 14 px)
    - `--shadow-card` (a soft two-layer shadow)
    - `--color-card` (the card surface)
    - `--color-label` (muted uppercase section labels)
  - **Shared classes:**
    - `.section-label`: `text-xs`, uppercase, letter-spacing `0.05em`, `--color-label`
    - `.btn-quiet`: a borderless secondary button with a hover tint
- Produces, `panel/SectionLabel.tsx`: `export function SectionLabel({ children }: { children: ReactNode }): JSX.Element`. It renders an `h3` with class `section-label`, so the accessible heading names stay `Script`, `Cues` and `Choices`.

**If interrupted:** nothing leaves state outside the working tree.

## Checkpoint 5A: Tokens, cards and panels

- [ ] **Step 5A.1: Write the failing e2e test** in `e2e/editor-look.spec.ts`, with a `// Protects:` header naming design goal 4 and both themes. The test is **`cards and panels use the soft look in both themes`**:
  1. Take a node with a choice and a cue, and select it.
  2. **For each theme** (toggle with the top-bar theme button):
     - **The card:** `getComputedStyle(card)` has `border-radius` of at least 12 px and a `box-shadow` other than `none`.
     - **The panel's `Choices` heading:** `text-transform` is `uppercase`.
     - **No scrolling:** `document.documentElement.scrollHeight` equals `innerHeight`.
- [ ] **Step 5A.2: Run** `npm run test:e2e -- e2e/editor-look.spec.ts`. Expect a FAIL.
- [ ] **Step 5A.3: Implement.**
  - **The card:**
    - `rounded-[var(--radius-lg)]`, `shadow-[var(--shadow-card)]` and the `--color-card` surface
    - the header tinted with the node colour, on the existing palette, which is the one allowed inline colour
    - roomier padding
    - the script preview at `text-[13px]`
    - choice rows as small pills
    - cue tags in the accent colour
  - **Panels:** `Script`, `Cues` and `Choices` use `SectionLabel`, and secondary buttons use `.btn-quiet`.
  - **Rule:** no hex outside the tokens and `colors.ts`, and nothing copied from the prototype.
- [ ] **Step 5A.4: Run** the new spec, then the whole e2e suite (`npm run test:e2e`), which includes the performance projects. Expect a PASS. Close the checkpoint with one commit: `feat: a cleaner look for cards and panels`.

## Test plan
### Cases
| ID | Behaviour | Layer | Input | Expected | Test |
|---|---|---|---|---|---|
| C1 | soft look in both themes | e2e | a selected node with a choice and a cue, light then dark | radius ≥ 12 px, a shadow, uppercase section label, no page scroll | e2e/editor-look.spec.ts :: cards and panels use the soft look in both themes |
| C2 | 500 nodes still in budget | e2e | the performance spec, run alone | within 3 s in both browsers | e2e/editor-performance.spec.ts :: a 500-node chapter opens within budget |
| C3 | it looks right to the developer | manual | the editor beside the hosted prototype, light and dark | the developer accepts the look | |
### Probes
**Probe folder:** none
### Breaks
none
### Flow
1. Put the editor and the hosted prototype side by side in both themes.
2. Compare cards, panels, the tool strip and tooltips.

Record what you saw in `progress.md`.
### Evidence
The full output of `npm run check:task`, the failing run of Step 5A.2, the full e2e run, and the Flow record.
