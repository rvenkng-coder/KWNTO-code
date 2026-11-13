// Finds test declarations and expect( calls with a small scanner that knows strings, template
// literals, regex literals and comments, so comment markers inside strings cannot hide code.
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'case', 'else', 'do', 'in', 'of', 'delete', 'void', 'yield', 'await', 'instanceof', 'new', 'throw'])
const REGEX_AFTER_CHAR = '(,=:[!&|?{};>)'

export interface Scan { masked: string; unterminated: boolean } // unterminated: ended inside a block comment or template literal

export function scanSource(source: string): Scan {
  const out = source.split('')
  const blank = (from: number, to: number): void => {
    for (let k = from; k < Math.min(to, out.length); k++) if (out[k] !== '\n') out[k] = ' '
  }
  let unterminated = false
  let i = 0
  let prev = ''
  let prevWord = ''
  while (i < source.length) {
    const c = source[i]
    const next = source[i + 1]
    if (c === '/' && next === '/') {
      const end = source.indexOf('\n', i)
      const stop = end < 0 ? source.length : end
      blank(i, stop)
      i = stop
    } else if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2)
      if (end < 0) unterminated = true
      const stop = end < 0 ? source.length : end + 2
      blank(i, stop)
      i = stop
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      while (j < source.length && source[j] !== c && !(c !== '`' && source[j] === '\n')) j += source[j] === '\\' ? 2 : 1
      if (c === '`' && j >= source.length) unterminated = true
      blank(i + 1, j)
      i = j + 1
      prev = c
    } else if (c === '/' && (prev === '' || REGEX_AFTER_CHAR.includes(prev) || (prev === 'w' && REGEX_AFTER_WORD.has(prevWord)))) {
      let j = i + 1
      let inClass = false
      while (j < source.length && source[j] !== '\n' && (inClass || source[j] !== '/')) {
        if (source[j] === '\\') j++
        else if (source[j] === '[') inClass = true
        else if (source[j] === ']') inClass = false
        j++
      }
      blank(i + 1, j)
      i = j + 1
      prev = '/'
    } else if (/[\w$]/.test(c)) {
      let j = i
      while (j < source.length && /[\w$]/.test(source[j])) j++
      prevWord = source.slice(i, j)
      prev = 'w'
      i = j
    } else {
      if (!/\s/.test(c)) prev = c
      i++
    }
  }
  return { masked: out.join(''), unterminated }
}

export const maskNonCode = (source: string): string => scanSource(source).masked

export interface Declaration { line: number; title: string | null } // title null: not a plain string literal

// A name preceded by anything but an identifier character or `.` (so `await test(`, `= it(`, `/* c */ test(` count).
const DECLARATION = /(^|[^\w$.])(?:test|it)((?:\.[A-Za-z]+)*)\s*[(<`]/gm

function titleAfter(source: string, masked: string, open: number, each: boolean): string | null {
  const skipSpace = (from: number): number => {
    let p = from
    while (p < masked.length && /\s/.test(masked[p])) p++
    return p
  }
  let p = open + 1
  if (each) {
    if (masked[open] === '`') {
      const close = masked.indexOf('`', p)
      if (close < 0) return null
      p = close + 1
    } else if (masked[open] === '(') {
      for (let depth = 1; p < masked.length && depth > 0; p++) depth += masked[p] === '(' ? 1 : masked[p] === ')' ? -1 : 0
    } else return null
    p = skipSpace(p)
    if (masked[p] !== '(') return null
    p++
  } else if (masked[open] !== '(') return null
  p = skipSpace(p)
  const quote = masked[p]
  if (quote !== '"' && quote !== "'" && quote !== '`') return null
  const close = masked.indexOf(quote, p + 1)
  return close < 0 ? null : source.slice(p + 1, close)
}

export function findDeclarations(source: string): Declaration[] {
  const masked = maskNonCode(source)
  const found: Declaration[] = []
  let line = 1
  let counted = 0 // source[0, counted) has been scanned for line breaks
  for (const match of masked.matchAll(DECLARATION)) {
    const keyword = match.index + match[1].length
    const open = match.index + match[0].length - 1
    for (; counted < keyword; counted++) if (source[counted] === '\n') line++
    found.push({
      line,
      title: titleAfter(source, masked, open, match[2].includes('.each')),
    })
  }
  return found
}

const EXPECT = /\bexpect(?:\.(?:soft|poll))?\s*\(/g

export function countExpects(source: string): number {
  return (maskNonCode(source).match(EXPECT) ?? []).length
}

// Raw views (no scanner): they over-count comments and strings, and so cannot be fooled by a scanner mistake.
export const countRawExpects = (source: string): number => (source.match(EXPECT) ?? []).length
export const countRawDeclarations = (source: string): number => (source.match(DECLARATION) ?? []).length

// Line numbers (1-based) of raw rows that look like a declaration at the start of a row or after `{ ; = => await return`.
const RAW_DECLARATION = /(?:^|[{;=]|=>|\b(?:await|return))\s*(?:\/\*.*?\*\/\s*)?(?:test|it)(?:\.[A-Za-z]+)*\s*[(<`]/
export function rawDeclarationLines(source: string): number[] {
  const rows = source.split('\n')
  return rows.flatMap((row, index) => (RAW_DECLARATION.test(row) ? [index + 1] : []))
}
