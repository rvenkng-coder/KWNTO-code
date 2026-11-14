# Styling

Decision D1 of the [editor core plan](../superpowers/plans/2026-11-14-editor-core/README.md): one set of theme tokens, Tailwind utilities on top of them, no component library.

## Tokens

They are CSS variables in `frontend/src/index.css`, set on `:root` (light) and overridden under `[data-theme="dark"]` on `<html>`.

| Token | Use |
|---|---|
| `--color-bg` | page background |
| `--color-panel` | panels, inputs, top bar |
| `--color-border` | thin borders |
| `--color-text`, `--color-muted` | body text, secondary text |
| `--color-accent`, `--color-accent-text` | the one blue accent and the text on it |
| `--color-danger` | errors and destructive buttons |
| `--radius`, `--shadow` | corner radius; soft shadow in light, none in dark |
| `--canvas-dot` | dot-grid colour of the canvas (Task 10) |

Light has white panels and a soft shadow. Dark has flat solid panels, thin borders and no shadow. No blur and no transparency on panels (design 6.6).

`@theme inline` maps the colour tokens into Tailwind, so `bg-panel`, `text-muted`, `border-border`, `text-danger` and the like work.

## Shared classes

In `@layer components`: `.panel`, `.field` (inputs), `.btn`, `.btn-primary`, `.btn-danger`, `.link-button` (a button that looks like a link). Use them instead of repeating utilities.

## Rules

- **No hex colours and no `style={{...}}` colours in components.** The one exception is the node header palette in `frontend/src/features/editor/model/colors.ts`.
- **Forms** are one column, `max-w-sm w-full`, inputs `w-full`, so nothing is cut at 390 px.
- **Add a colour:** add a variable under `:root` and under `[data-theme="dark"]`, add the same name to `@theme inline`, then use the utility. A colour with only a light value is a bug.
- **Switching the theme:** `applyTheme` in `frontend/src/features/shell/theme.ts` sets `data-theme` on `<html>`.
