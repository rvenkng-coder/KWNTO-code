import { scopesFor, type ExportFormat, type ExportScope } from './exportPlan'

const FORMATS: Array<{ value: ExportFormat; label: string }> = [
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'Word' },
  { value: 'jpg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
]
const SCOPES: Array<{ value: ExportScope; label: string }> = [
  { value: 'chapter', label: 'Current chapter' },
  { value: 'project', label: 'Whole project' },
]

interface ChoicesProps {
  format: ExportFormat
  scope: ExportScope
  disabled: boolean
  onFormat(f: ExportFormat): void
  onScope(s: ExportScope): void
}

/** The two radio groups of the Export map dialog: the format, and what to export (images allow the current chapter only). */
export function ExportChoices({ format, scope, disabled, onFormat, onScope }: ChoicesProps) {
  const allowed = scopesFor(format)
  return (
    <>
      <fieldset className="flex flex-col gap-1" disabled={disabled}>
        <legend className="mb-1 font-medium">Format</legend>
        {FORMATS.map((f) => (
          <label key={f.value} className="flex items-center gap-2">
            <input type="radio" name="export-format" checked={format === f.value} onChange={() => onFormat(f.value)} />
            {f.label}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-1" disabled={disabled}>
        <legend className="mb-1 font-medium">What to export</legend>
        {SCOPES.map((s) => (
          <label key={s.value} className="flex items-center gap-2">
            <input
              type="radio"
              name="export-scope"
              checked={scope === s.value}
              disabled={!allowed.includes(s.value)}
              onChange={() => onScope(s.value)}
            />
            {s.label}
          </label>
        ))}
        {allowed.length === 1 && <p className="text-sm text-muted">Images export the current chapter only.</p>}
      </fieldset>
    </>
  )
}
