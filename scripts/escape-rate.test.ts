import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { escapeRate, parseProgress, type ProgressRow } from './escape-rate.ts'

const SCRIPT = join(import.meta.dirname, 'escape-rate.ts')
const HEADER = '| Date | Task | Built by | What happened | Review | Escaped | Next |\n|---|---|---|---|---|---|---|\n'
const row = (task: string, by: string, review: string, escaped: string) => `| 2026-11-13 | ${task} | ${by} | did it | ${review} | ${escaped} | next |\n`

const dirs: string[] = []
function progressFile(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'escape-rate-'))
  dirs.push(dir)
  const path = join(dir, 'progress.md')
  writeFileSync(path, content)
  return path
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

function run(...args: string[]) {
  const result = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' })
  return { code: result.status, out: result.stdout + result.stderr }
}
const make = (builtBy: 'local' | 'strong' | '', escaped: number): ProgressRow => ({ task: 't', builtBy, review: 'none', escaped })

describe('parseProgress', () => {
  // Protects the column lookup: columns are found by header name, so other columns around them do not matter.
  test('parseProgress reads the three columns from a table with other columns around them', () => {
    const md = `# Progress\n\nintro\n\n${HEADER}${row('Task 1', 'local', 'clean', '0')}${row('Task 2', 'strong', 'none', '0')}${row('Task 3', 'local', 'found 2', '2')}`
    expect(parseProgress(md)).toEqual({
      problems: [],
      rows: [
        { task: 'Task 1', builtBy: 'local', review: 'clean', escaped: 0 },
        { task: 'Task 2', builtBy: 'strong', review: 'none', escaped: 0 },
        { task: 'Task 3', builtBy: 'local', review: 'found 2', escaped: 2 },
      ],
    })
  })

  // Protects fail-closed: a progress file that does not track the columns cannot be measured.
  test('a table without the columns gives a problem', () => {
    const result = parseProgress('| Date | Task | What happened | Next |\n|---|---|---|---|\n| d | t | w | n |\n')
    expect(result.rows).toEqual([])
    expect(result.problems.join('\n')).toMatch(/Built by.*Review.*Escaped/)
  })

  // Protects the review-sampling input: "1x", empty, negative and fractional cells are problems, never 0.
  test('a row with a non-numeric Escaped cell is a problem, not 0', () => {
    for (const cell of ['1x', '', 'n/a', '-1', '1.5']) {
      const result = parseProgress(HEADER + row('Task 9', 'local', 'clean', cell))
      expect(result.rows, cell).toEqual([])
      expect(result.problems.join('\n'), cell).toMatch(/Task 9.*Escaped/)
    }
  })

  // Protects the same rule for Built by: a typo must not turn a local task into an uncounted one.
  test('an unknown Built by value is a problem', () => {
    const result = parseProgress(HEADER + row('Task 4', 'locl', 'none', '0'))
    expect(result.rows).toEqual([])
    expect(result.problems.join('\n')).toMatch(/Task 4.*Built by/)
  })

  // Protects fail-closed: an empty file is a problem, not an empty measurement.
  test('empty file gives a problem', () => {
    expect(parseProgress('').problems.length).toBeGreaterThan(0)
    expect(parseProgress('  \n\n').problems.length).toBeGreaterThan(0)
  })

  // Protects against a header with no rows: the table exists but nothing is measurable, which is a problem.
  test('a table with the columns and no task rows gives a problem', () => {
    expect(parseProgress(HEADER).problems.join('\n')).toMatch(/no task rows/)
  })

  // Protects fail-closed: a named task row with Built by, Review and Escaped all empty is a problem, never skipped.
  test('a named task row with all three cells empty is a problem', () => {
    const result = parseProgress(HEADER + row('T3', '', '', '') + row('T1', 'local', 'none', '0'))
    expect(result.rows).toEqual([])
    expect(result.problems.join('\n')).toMatch(/T3/)
  })

  // Protects the explicit non-task marker: Built by "-" rows are not counted and need no other cells.
  test('a non-task row marked with Built by - is not counted', () => {
    const md = HEADER + row('Plan written', '-', '-', '-') + row('Plan edited', '-', '', '') + row('T1', 'local', 'none', '1')
    const result = parseProgress(md)
    expect(result.problems).toEqual([])
    expect(result.rows.map((r) => r.task)).toEqual(['T1'])
  })

  // Protects fail-closed: a task row with a blank Built by and a valid Escaped must not be silently left out of the rate.
  test('a named task row with a blank Built by is a problem', () => {
    const result = parseProgress(HEADER + row('T3', '', 'none', '0') + row('T1', 'local', 'none', '0'))
    expect(result.rows).toEqual([])
    expect(result.problems.join('\n')).toMatch(/T3.*Built by/)
  })

  // Pins current behaviour: a row of single dashes outside the separator position is a non-task row (Built by is -), not counted.
  test('a row of single dashes outside the separator position is a non-task row', () => {
    const result = parseProgress(HEADER + row('T1', 'local', 'none', '1') + '| - | - | - | - | - | - | - |\n')
    expect(result.problems).toEqual([])
    expect(result.rows.map((r) => r.task)).toEqual(['T1'])
  })

  // Protects the separator rule: an all-dash row that is not directly under the header is a problem.
  test('an all-dash row outside the separator position is a problem', () => {
    const result = parseProgress(HEADER + row('T1', 'local', 'none', '0') + '|---|---|---|---|---|---|---|\n')
    expect(result.rows).toEqual([])
    expect(result.problems.length).toBeGreaterThan(0)
  })

  // Protects against a partial table: a blank line between rows must not drop the later rows silently.
  test('a row after a blank line is a problem, not dropped', () => {
    const result = parseProgress(HEADER + row('T1', 'local', 'none', '0') + '\n' + row('T2', 'local', 'none', '3'))
    expect(result.rows).toEqual([])
    expect(result.problems.join('\n')).toMatch(/table interrupted at line 4/)
  })

  // Protects a short row: a missing Escaped cell is a problem, not 0.
  test('a row shorter than the header is a problem', () => {
    const result = parseProgress(HEADER + '| 2026-11-13 | Task 5 | local |\n')
    expect(result.problems.join('\n')).toMatch(/Task 5/)
  })

  // Protects fail-closed: a row with only date and task is a problem naming the row, not skipped.
  test('a short row with only a date and task is a problem', () => {
    const result = parseProgress(HEADER + '| d | T2 |\n' + row('T1', 'local', 'none', '0'))
    expect(result.rows).toEqual([])
    expect(result.problems.join('\n')).toMatch(/T2/)
  })
})

describe('escapeRate', () => {
  // Protects the definition: only local tasks count, and a task counts once however many problems escaped.
  test('escapeRate counts only local tasks', () => {
    const result = escapeRate([make('local', 3), make('local', 0), make('strong', 5), make('', 2), make('local', 0), make('local', 0)])
    expect(result).toEqual({ rate: 0.25, localTasks: 4, escapedTasks: 1 })
  })

  // Protects the empty case: no local tasks gives 0 without dividing by zero.
  test('no local tasks gives rate 0 with localTasks 0', () => {
    expect(escapeRate([make('strong', 2)])).toEqual({ rate: 0, localTasks: 0, escapedTasks: 0 })
    expect(escapeRate([])).toEqual({ rate: 0, localTasks: 0, escapedTasks: 0 })
  })
})

describe('the command', () => {
  // Protects fail-closed: no matching table means exit 1 with the reason, never "0%".
  test('the command exits 1 for a file with no matching table and prints why', () => {
    const result = run(progressFile('| Date | Task |\n|---|---|\n| d | t |\n'))
    expect(result.code).toBe(1)
    expect(result.out).toMatch(/Built by/)
    expect(result.out).not.toMatch(/%/)
  })

  // Protects the report: the share is printed in the documented form and the exit code is 0.
  test('the command prints the share and exits 0 otherwise', () => {
    const md = HEADER + row('T1', 'local', 'found 1', '1') + row('T2', 'local', 'clean', '0') + row('T3', 'local', 'none', '0') + row('T4', 'local', 'none', '0') + row('T5', 'strong', 'none', '0')
    const result = run(progressFile(md))
    expect(result.code).toBe(0)
    expect(result.out.trim()).toBe('escape rate: 1 of 4 local tasks (25%)')
  })

  // Protects fail-closed on bad cells: a problem row stops the report instead of lowering the rate.
  test('the command exits 1 and names the row when an Escaped cell is malformed', () => {
    const result = run(progressFile(HEADER + row('Task 8', 'local', 'none', '1x')))
    expect(result.code).toBe(1)
    expect(result.out).toMatch(/Task 8/)
    expect(result.out).not.toMatch(/%/)
  })

  // Protects fail-closed: an empty file exits 1 with its own message.
  test('the command exits 1 for an empty file', () => {
    const result = run(progressFile(''))
    expect(result.code).toBe(1)
    expect(result.out).toMatch(/empty/)
  })

  // Protects fail-closed: a missing file exits 1 with a message that names it.
  test('the command exits 1 for a missing file', () => {
    const result = run(join(tmpdir(), 'no-such-dir-escape-rate', 'progress.md'))
    expect(result.code).toBe(1)
    expect(result.out).toMatch(/cannot read.*progress\.md/)
  })

  // Protects fail-closed: a directory is unreadable as a file and exits 1 with the same message.
  test('the command exits 1 for an unreadable path (a directory)', () => {
    const result = run(tmpdir())
    expect(result.code).toBe(1)
    expect(result.out).toMatch(/cannot read/)
  })

  // Protects fail-closed through the command: a blank line inside the table exits 1 and prints no rate.
  test('the command exits 1 when the table is interrupted', () => {
    const result = run(progressFile(HEADER + row('T1', 'local', 'none', '0') + '\n' + row('T2', 'local', 'none', '3')))
    expect(result.code).toBe(1)
    expect(result.out).toMatch(/interrupted/)
    expect(result.out).not.toMatch(/%/)
  })

  // Protects the usage rule: no argument and extra arguments exit 1 with usage.
  test('the command exits 1 with usage for a missing or extra argument', () => {
    expect(run().code).toBe(1)
    expect(run().out).toMatch(/usage/i)
    expect(run('a', 'b').code).toBe(1)
  })
})
