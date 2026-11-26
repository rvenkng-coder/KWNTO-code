// Reads the comments of a TypeScript or JavaScript file with the TypeScript parser, for two checks:
// no comment may point at old project history, and a comment rewrite must leave the code unchanged.
import ts from 'typescript'

export interface CommentRef {
  line: number
  match: string
}

const PATTERNS = [
  /\b[Pp]lan (?:\d{4}-\d{2}-\d{2}[\w-]*|\d+[a-z]?\b)/,
  /\b(?:offline sync|editor core|editor cards|node links|media upload|sharing|deployment|export) plan\b/,
  /\bTask \d+/,
  /\bD\d{1,2}\b/,
  /\bfindings? [A-Z0-9]\b/,
  /\bC\d{1,2}\b/,
  /\bM\d{1,2}\b/,
  /Review Focus/,
]

function parse(path: string, source: string): ts.SourceFile {
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : path.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS
  return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind)
}

// Comments are the gaps around tokens. JSX text is left out: `//` there is text on screen.
function commentRanges(file: ts.SourceFile): ts.CommentRange[] {
  const ranges = new Map<number, ts.CommentRange>()
  const text: ts.Node[] = []
  const visit = (node: ts.Node) => {
    if (ts.isJSDoc(node)) return
    if (ts.isJsxText(node)) {
      text.push(node)
      return
    }
    const children = node.getChildren(file)
    if (children.length > 0) return children.forEach(visit)
    const around = [
      ...(ts.getLeadingCommentRanges(file.text, node.pos) ?? []),
      ...(ts.getTrailingCommentRanges(file.text, node.end) ?? []),
    ]
    for (const range of around) ranges.set(range.pos, range)
  }
  visit(file)
  const inText = (pos: number) => text.some((t) => pos >= t.pos && pos < t.end)
  return [...ranges.values()].filter((r) => !inText(r.pos)).sort((a, b) => a.pos - b.pos)
}

function matchesIn(comment: string): { index: number; match: string }[] {
  return PATTERNS.flatMap((pattern) =>
    [...comment.matchAll(new RegExp(pattern, 'g'))].map((m) => ({ index: m.index, match: m[0] })),
  ).sort((a, b) => a.index - b.index)
}

/** Every reference to project history in a comment of the file, in file order. */
export function findHistoryRefs(path: string, source: string): CommentRef[] {
  const file = parse(path, source)
  return commentRanges(file).flatMap((range) =>
    matchesIn(source.slice(range.pos, range.end)).map(({ index, match }) => ({
      line: file.getLineAndCharacterOfPosition(range.pos + index).line + 1,
      match,
    })),
  )
}

// What a JSX comment leaves behind: empty braces, and the line breaks around them. Neither renders.
const rendersNothing = (node: ts.Node) =>
  (ts.isJsxExpression(node) && node.expression === undefined) ||
  (ts.isJsxText(node) && node.containsOnlyTriviaWhiteSpaces)

function dropEmptyJsx(context: ts.TransformationContext) {
  const visit = (node: ts.Node): ts.Node | undefined =>
    rendersNothing(node) ? undefined : ts.visitEachChild(node, visit, context)
  return (file: ts.SourceFile) => ts.visitEachChild(file, visit, context)
}

/** The file printed without any comment: equal results mean only comments differ. */
export function codeWithoutComments(path: string, source: string): string {
  const result = ts.transform(parse(path, source), [dropEmptyJsx])
  const printed = ts.createPrinter({ removeComments: true }).printFile(result.transformed[0])
  result.dispose()
  return printed
}
