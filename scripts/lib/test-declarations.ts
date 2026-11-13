// Finds test declarations and expect( calls with a small scanner that knows strings, template
// literals, regex literals and comments, so comment markers inside strings cannot hide code.
export function maskNonCode(source: string): string {
  const out = source.split('')
  const blank = (from: number, to: number): void => {
    for (let k = from; k < Math.min(to, out.length); k++) if (out[k] !== '\n') out[k] = ' '
  }
  let i = 0
  let prev = ''
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
      const stop = end < 0 ? source.length : end + 2
      blank(i, stop)
      i = stop
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      while (j < source.length && source[j] !== c && !(c !== '`' && source[j] === '\n')) j += source[j] === '\\' ? 2 : 1
      blank(i + 1, j)
      i = j + 1
      prev = c
    } else if (c === '/' && (prev === '' || '(,=:[!&|?{};'.includes(prev))) {
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
    } else {
      if (!/\s/.test(c)) prev = c
      i++
    }
  }
  return out.join('')
}

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
  for (const match of masked.matchAll(DECLARATION)) {
    const keyword = match.index + match[1].length
    const open = match.index + match[0].length - 1
    found.push({
      line: source.slice(0, keyword).split('\n').length,
      title: titleAfter(source, masked, open, match[2].includes('.each')),
    })
  }
  return found
}

export function countExpects(source: string): number {
  return (maskNonCode(source).match(/\bexpect(?:\.(?:soft|poll))?\s*\(/g) ?? []).length
}
