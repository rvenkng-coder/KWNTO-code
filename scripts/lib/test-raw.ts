// Raw-text views of a test file (no parser). They over-count comments and strings, so they can only
// add false positives; they are the backstop for anything the parser-based view misjudges.
const DECLARATION = /(^|[^\w$.])(?:test|it)(?:\.[A-Za-z]+)*\s*[(<`]/gm
const EXPECT = /\bexpect(?:\s*\.\s*(?:soft|poll))?\s*\(/g
// A declaration at the start of a row or after `{ ; = => await return` (possibly after a short block comment).
const RAW_DECLARATION = /(?:^|[{;=]|=>|\b(?:await|return))\s*(?:\/\*.*?\*\/\s*)?(?:test|it)(?:\.[A-Za-z]+)*\s*[(<`]/

export const countRawExpects = (source: string): number => (source.match(EXPECT) ?? []).length
export const countRawDeclarations = (source: string): number => (source.match(DECLARATION) ?? []).length

// Line numbers (1-based) of raw rows that look like a declaration and have no comment directly above.
export function rawHeaderLines(source: string): number[] {
  const rows = source.split('\n')
  return rows.flatMap((row, index) => {
    if (!RAW_DECLARATION.test(row)) return []
    const above = index > 0 ? rows[index - 1].trim() : ''
    return above.startsWith('//') || above.endsWith('*/') ? [] : [index + 1]
  })
}
