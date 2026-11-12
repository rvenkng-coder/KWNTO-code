// Checks docs/engineering.md section 1: every PERF: comment must hold What:, Why: and Trade-off:.
// Run directly (node scripts/check-perf-comments.ts) it checks every .ts/.tsx file under src/.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const REQUIRED_PARTS = ['What:', 'Why:', 'Trade-off:']

interface Comment {
  line: number
  text: string
}

// A comment is one /* */ block, or a run of adjacent // lines. A line with PERF: always starts
// a new comment, so two PERF: notes in one run are judged separately.
function collectComments(source: string): Comment[] {
  const comments: Comment[] = []

  for (const block of source.matchAll(/\/\*[\s\S]*?\*\//g)) {
    const line = source.slice(0, block.index).split('\n').length
    comments.push({ line, text: block[0] })
  }

  let run: Comment | null = null
  source.split('\n').forEach((raw, index) => {
    const lineNumber = index + 1
    const start = raw.indexOf('//')
    if (start === -1) {
      run = null
      return
    }
    const text = raw.slice(start + 2)
    const commentOnly = raw.slice(0, start).trim() === ''
    if (run && commentOnly && !text.includes('PERF:')) {
      run.text += `\n${text}`
      return
    }
    run = { line: lineNumber, text }
    comments.push(run)
    if (!commentOnly) run = null
  })

  return comments
}

// Returns the 1-based line of every PERF: comment that lacks What:, Why: or Trade-off:.
export function findBadPerfComments(source: string): number[] {
  const bad: number[] = []
  for (const comment of collectComments(source)) {
    const marker = comment.text.indexOf('PERF:')
    if (marker === -1) continue
    const line = comment.line + comment.text.slice(0, marker).split('\n').length - 1
    if (REQUIRED_PARTS.some((part) => !comment.text.includes(part))) bad.push(line)
  }
  return bad.sort((a, b) => a - b)
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .map((file) => join(dir, file))
}

if (import.meta.filename === process.argv[1]) {
  let problems = 0
  for (const file of sourceFiles('src')) {
    for (const line of findBadPerfComments(readFileSync(file, 'utf8'))) {
      console.log(`${file}:${line} PERF comment needs What:, Why: and Trade-off:`)
      problems++
    }
  }
  process.exit(problems > 0 ? 1 : 0)
}
