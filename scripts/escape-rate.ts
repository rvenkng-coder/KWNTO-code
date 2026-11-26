// Share of tasks built by a local model that had a problem escape after close (docs/developer/review-sampling.md).
// node scripts/escape-rate.ts <progress.md>
import { readFileSync } from 'node:fs'
import { isMain } from './lib/is-main.ts'

export interface ProgressRow {
  task: string
  builtBy: 'local' | 'strong' | ''
  review: string
  escaped: number
}

const NEEDED = ['built by', 'review', 'escaped']
// Exported so check:task can tell "this file does not track escapes" from a malformed table.
export const MISSING_TABLE =
  'no table with the columns "Built by", "Review" and "Escaped"; a progress file that does not track them cannot be measured'

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

const isTableLine = (line: string): boolean => line.trim().startsWith('|')
const isSeparator = (line: string): boolean => /^\|?[\s:|-]+\|?$/.test(line.trim()) && line.includes('-')

interface Columns {
  task: number
  builtBy: number
  review: number
  escaped: number
}

function findHeader(lines: string[]): { index: number; columns: Columns } | null {
  for (let index = 0; index < lines.length; index++) {
    if (!isTableLine(lines[index])) continue
    const names = cells(lines[index]).map((name) => name.toLowerCase())
    if (!NEEDED.every((name) => names.includes(name))) continue
    const task = names.indexOf('task')
    return {
      index,
      columns: {
        task: task === -1 ? 0 : task,
        builtBy: names.indexOf('built by'),
        review: names.indexOf('review'),
        escaped: names.indexOf('escaped'),
      },
    }
  }
  return null
}

function cellAt(row: string[], index: number): string {
  return row[index] ?? ''
}

function rowProblem(label: string, built: string, escaped: string): string | null {
  if (built !== 'local' && built !== 'strong')
    return `${label}: "Built by" must be local or strong (or - for a non-task row), got "${built}"`
  if (!/^\d+$/.test(escaped)) return `${label}: "Escaped" must be a whole number (0 if none), got "${escaped}"`
  return null
}

// A task row needs a valid Built by and a whole-number Escaped; only Built by `-` marks a non-task row.
function parseRow(row: string[], columns: Columns): ProgressRow | string | null {
  const task = cellAt(row, columns.task)
  const built = cellAt(row, columns.builtBy).toLowerCase()
  const review = cellAt(row, columns.review)
  const escaped = cellAt(row, columns.escaped)
  if (built === '-') return null // explicitly marked as a non-task row (e.g. "Plan written")
  const problem = rowProblem(task || '(no task name)', built, escaped)
  if (problem !== null) return problem
  return { task, builtBy: built as ProgressRow['builtBy'], review, escaped: Number(escaped) }
}

function readRows(
  lines: string[],
  header: { index: number; columns: Columns },
): { rows: ProgressRow[]; problems: string[] } {
  const rows: ProgressRow[] = []
  const problems: string[] = []
  let end = header.index + 1
  if (end < lines.length && isSeparator(lines[end])) end++
  while (end < lines.length && isTableLine(lines[end])) {
    const parsed = parseRow(cells(lines[end]), header.columns)
    if (typeof parsed === 'string') problems.push(parsed)
    else if (parsed !== null) rows.push(parsed)
    end++
  }
  const later = lines.findIndex((line, index) => index >= end && isTableLine(line))
  if (later !== -1)
    problems.push(`table interrupted at line ${end + 1}; later rows (line ${later + 1}) would be ignored`)
  return { rows, problems }
}

export function parseProgress(markdown: string): { rows: ProgressRow[]; problems: string[] } {
  if (markdown.trim() === '') return { rows: [], problems: ['the progress file is empty'] }
  const lines = markdown.split(/\r?\n/)
  const header = findHeader(lines)
  if (header === null) return { rows: [], problems: [MISSING_TABLE] }
  const { rows, problems } = readRows(lines, header)
  if (problems.length > 0) return { rows: [], problems }
  if (rows.length === 0) return { rows: [], problems: ['the table has no task rows'] }
  return { rows, problems }
}

export function escapeRate(rows: ProgressRow[]): { rate: number; localTasks: number; escapedTasks: number } {
  const local = rows.filter((row) => row.builtBy === 'local')
  const escapedTasks = local.filter((row) => row.escaped > 0).length
  return { rate: local.length === 0 ? 0 : escapedTasks / local.length, localTasks: local.length, escapedTasks }
}

function fail(message: string): never {
  console.log(`escape-rate: ${message}`)
  process.exit(1)
}

if (isMain(import.meta.filename)) {
  const args = process.argv.slice(2)
  if (args.length !== 1) fail('usage: node scripts/escape-rate.ts <progress.md>')
  let markdown: string
  try {
    markdown = readFileSync(args[0], 'utf8')
  } catch {
    fail(`cannot read ${args[0]}`)
  }
  const { rows, problems } = parseProgress(markdown)
  if (problems.length > 0) fail(problems.join('\n'))
  const { rate, localTasks, escapedTasks } = escapeRate(rows)
  console.log(`escape rate: ${escapedTasks} of ${localTasks} local tasks (${Math.round(rate * 100)}%)`)
}
