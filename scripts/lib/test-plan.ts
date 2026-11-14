// Parser for the per-task "Test plan" block (docs/developer/test-plan-format.md).
// Fail closed: anything it does not understand is a problem, never an empty plan.
export type Layer = 'unit' | 'rules' | 'e2e' | 'container' | 'manual'
export interface CaseRow { id: string; behaviour: string; layer: Layer; input: string; expected: string; test: string } // test is "path :: title", or "" for manual
export interface BreakRow { id: string; file: string; find: string; replace: string; tests: string[] }
export interface TestPlan { cases: CaseRow[]; probeFolder: string | null; breaks: BreakRow[]; flow: string; evidence: string }
export interface TaskMeta { tier: 'strong' | 'mid' | 'local' | null; hasInterfaces: boolean }

const LAYERS: readonly string[] = ['unit', 'rules', 'e2e', 'container', 'manual']
const TIERS = ['strong', 'mid', 'local'] as const
const SECTIONS = ['Cases', 'Probes', 'Breaks', 'Flow', 'Evidence'] as const
const CASE_COLUMNS = ['ID', 'Behaviour', 'Layer', 'Input', 'Expected', 'Test']
const BREAK_COLUMNS = ['ID', 'File', 'Find', 'Replace', 'Tests']
const BREAKABLE_ROOTS = ['frontend/src/', 'scripts/', 'backend/pb_hooks/lib/']

export function parseTaskMeta(markdown: string): TaskMeta {
  const text = markdown.replaceAll('\r\n', '\n')
  const tier = /^\*\*Model tier:\*\*[ \t]*(\S+)/m.exec(text)?.[1]
  return {
    tier: TIERS.find((name) => name === tier) ?? null,
    hasInterfaces: /^\*\*Interfaces:\*\*/m.test(text),
  }
}

// A break may touch only code Vitest reaches (design 6.3): never a test, a hook file, or a path that escapes.
export function isBreakablePath(path: string): boolean {
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) return false
  if (path.split(/[\\/]/).includes('..')) return false
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(path)) return false
  return BREAKABLE_ROOTS.some((root) => path.startsWith(root) && path.length > root.length)
}

// Splits on unescaped pipes; `\|` becomes a literal pipe; one pair of outer backticks is stripped.
function splitRow(line: string): string[] {
  const cells: string[] = []
  let current = ''
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\' && line[i + 1] === '|') { current += '\\|'; i++ }
    else if (line[i] === '|') { cells.push(current); current = '' }
    else current += line[i]
  }
  cells.push(current)
  if (cells[0].trim() === '') cells.shift()
  if (cells.length > 0 && current.trim() === '') cells.pop()
  return cells.map((cell) => {
    const trimmed = cell.trim()
    const inner = trimmed.length >= 2 && trimmed.startsWith('`') && trimmed.endsWith('`') ? trimmed.slice(1, -1) : trimmed
    return inner.replaceAll('\\|', '|')
  })
}

// Reads a GitHub table. Returns data rows, or null (with problems added) when the table is malformed.
function readTable(section: string, body: string[], columns: string[], problems: string[]): string[][] | null {
  const lines = body.filter((line) => line.trim() !== '')
  const stray = lines.filter((line) => !line.trim().startsWith('|'))
  if (stray.length > 0) problems.push(`${section}: unexpected text outside the table: "${stray[0].trim()}"`)
  const tableLines = lines.filter((line) => line.trim().startsWith('|'))
  if (tableLines.length === 0) { problems.push(`${section}: no table found`); return null }
  const header = splitRow(tableLines[0])
  if (header.join('|') !== columns.join('|')) {
    problems.push(`${section}: header must be "${columns.join(' | ')}", found "${header.join(' | ')}"`)
    return null
  }
  if (!tableLines[1] || !/^\|?[\s:|-]*-[\s:|-]*\|?$/.test(tableLines[1].trim())) {
    problems.push(`${section}: the second table line must be the |---| separator`)
    return null
  }
  const rows = tableLines.slice(2).map(splitRow)
  if (rows.length === 0) problems.push(`${section}: table has no rows`)
  return rows
}

function parseCases(body: string[], problems: string[]): CaseRow[] {
  const cases: CaseRow[] = []
  const seen = new Set<string>()
  for (const [index, cells] of (readTable('Cases', body, CASE_COLUMNS, problems) ?? []).entries()) {
    const label = `Cases ${cells[0] || `row ${index + 1}`}`
    if (cells.length !== CASE_COLUMNS.length) { problems.push(`${label}: expected ${CASE_COLUMNS.length} cells, found ${cells.length}`); continue }
    const [id, behaviour, layer, input, expected, test] = cells
    if (id === '') problems.push(`${label}: empty ID`)
    else if (seen.has(id)) problems.push(`${label}: duplicate id`)
    seen.add(id)
    for (const [name, value] of [['Behaviour', behaviour], ['Input', input], ['Expected', expected]]) {
      if (value === '') problems.push(`${label}: empty ${name}`)
    }
    if (!LAYERS.includes(layer)) { problems.push(`${label}: unknown layer "${layer}" (use ${LAYERS.join(', ')})`); continue }
    if (layer !== 'manual' && test === '') problems.push(`${label}: a test reference is required unless the layer is manual`)
    else if (layer !== 'manual' && !/^\S.* :: \S.*$/.test(test)) problems.push(`${label}: Test must read "path :: title"`)
    cases.push({ id, behaviour, layer: layer as Layer, input, expected, test })
  }
  return cases
}

// A lone `none` means no breaks; allowed only when no case is on the unit layer (Task 5's contract).
function isNone(body: string[]): boolean {
  const lines = body.filter((line) => line.trim() !== '')
  return lines.length === 1 && lines[0].trim().toLowerCase() === 'none'
}

function parseBreaks(body: string[], cases: CaseRow[], problems: string[]): BreakRow[] {
  if (isNone(body)) {
    const unitIds = cases.filter((row) => row.layer === 'unit').map((row) => row.id)
    if (unitIds.length > 0) problems.push(`Breaks: "none" is not allowed while unit cases exist (${unitIds.join(', ')}); list at least one break`)
    return []
  }
  const breaks: BreakRow[] = []
  const seen = new Set<string>()
  for (const [index, cells] of (readTable('Breaks', body, BREAK_COLUMNS, problems) ?? []).entries()) {
    const label = `Breaks ${cells[0] || `row ${index + 1}`}`
    if (cells.length !== BREAK_COLUMNS.length) { problems.push(`${label}: expected ${BREAK_COLUMNS.length} cells, found ${cells.length}`); continue }
    const [id, file, find, replace, testsCell] = cells
    if (id === '') problems.push(`${label}: empty ID`)
    else if (seen.has(id)) problems.push(`${label}: duplicate id`)
    seen.add(id)
    if (!isBreakablePath(file)) problems.push(`${label}: File "${file}" must be under frontend/src/, scripts/ or backend/pb_hooks/lib/ and not a test file`)
    if (find === '') problems.push(`${label}: Find must not be empty`)
    else if (find === replace) problems.push(`${label}: Replace must differ from Find`)
    const tests = testsCell.split(',').map((path) => path.trim()).filter((path) => path !== '')
    if (tests.length === 0) problems.push(`${label}: Tests must name at least one test file`)
    for (const path of tests) {
      if (path.startsWith('/') || path.split(/[\\/]/).includes('..')) problems.push(`${label}: Tests path "${path}" must be relative and stay inside the repo`)
    }
    breaks.push({ id, file, find, replace, tests })
  }
  return breaks
}

function parseProbeFolder(body: string[], problems: string[]): string | null {
  const line = body.find((candidate) => candidate.startsWith('**Probe folder:**'))
  if (!line) { problems.push('Probes: missing the "**Probe folder:**" line (write `none` for no probes)'); return null }
  const value = splitRow(`|${line.slice('**Probe folder:**'.length)}|`)[0] ?? ''
  if (value === 'none') return null
  if (!value.startsWith('tests/probes/') || value.split(/[\\/]/).includes('..')) {
    problems.push(`Probes: the probe folder must start with tests/probes/ (found "${value}")`)
    return null
  }
  return value
}

interface Section { name: string; body: string[] }

// Splits the lines under "## Test plan" into "###" sections. Headings inside code fences are ignored.
function splitSections(lines: string[], problems: string[]): Section[] {
  const sections: Section[] = []
  let fenced = false
  for (const line of lines) {
    if (line.trimStart().startsWith('```')) fenced = !fenced
    const heading = !fenced ? /^###\s+(.*?)\s*$/.exec(line) : null
    if (heading) sections.push({ name: heading[1], body: [] })
    else if (sections.length > 0) sections[sections.length - 1].body.push(line)
    else if (line.trim() !== '') problems.push(`Test plan: text before the first "###" section: "${line.trim()}"`)
  }
  return sections
}

function checkSectionNames(sections: Section[], problems: string[]): void {
  const names = sections.map((section) => section.name)
  for (const name of names) {
    if (!(SECTIONS as readonly string[]).includes(name)) problems.push(`Test plan: unknown section "### ${name}" (expected ${SECTIONS.join(', ')})`)
  }
  for (const name of SECTIONS) {
    const count = names.filter((found) => found === name).length
    if (count === 0) problems.push(`Test plan: missing section "### ${name}"`)
    if (count > 1) problems.push(`Test plan: section "### ${name}" appears ${count} times`)
  }
  const known = names.filter((name) => (SECTIONS as readonly string[]).includes(name))
  const expectedOrder = SECTIONS.filter((name) => known.includes(name))
  if (known.length === new Set(known).size && known.join() !== expectedOrder.join()) {
    problems.push(`Test plan: sections are out of order (expected ${SECTIONS.join(', ')})`)
  }
}

export function parseTestPlan(markdown: string): { plan: TestPlan | null; problems: string[] } {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n')
  const problems: string[] = []
  const starts = lines.flatMap((line, index) => (line.trimEnd() === '## Test plan' ? [index] : []))
  if (starts.length === 0) return { plan: null, problems: ['Test plan: missing the "## Test plan" heading'] }
  if (starts.length > 1) problems.push('Test plan: the "## Test plan" heading appears more than once')
  // Whole-line HTML comments are notes to the author (the task template uses them), not content.
  const rest = lines.slice(starts[0] + 1).filter((line) => !/^\s*<!--.*-->\s*$/.test(line))
  const end = rest.findIndex((line) => /^##\s/.test(line))
  const sections = splitSections(end === -1 ? rest : rest.slice(0, end), problems)
  checkSectionNames(sections, problems)

  const bodyOf = (name: string): string[] => sections.find((section) => section.name === name)?.body ?? []
  const text = (name: string): string => bodyOf(name).join('\n').trim()
  for (const name of ['Flow', 'Evidence']) {
    if (sections.some((section) => section.name === name) && text(name) === '') problems.push(`${name}: section is empty`)
  }
  const cases = parseCases(bodyOf('Cases'), problems)
  const plan: TestPlan = {
    cases,
    probeFolder: parseProbeFolder(bodyOf('Probes'), problems),
    breaks: parseBreaks(bodyOf('Breaks'), cases, problems),
    flow: text('Flow'),
    evidence: text('Evidence'),
  }
  return { plan, problems }
}
