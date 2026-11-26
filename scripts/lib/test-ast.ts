// Finds test declarations and expect( calls with the real TypeScript parser (already a devDependency),
// so strings, comments, regex literals and JSX text are never mistaken for code, and code in any
// expression position (conditional, export default, comma, template ${}, JSX) is found.
import ts from 'typescript'

export interface Declaration {
  line: number // 1-based line where the call starts
  title: string | null // null when not a readable literal
  key: string // title, or the source text of an unreadable title (so a swap is still visible)
  headerProblem: string | null // why the statement has no header comment directly above, or null
}
export interface ParsedFile {
  ok: boolean
  error: string | null
  declarations: Declaration[]
  expects: number
}

function scriptKind(path: string): ts.ScriptKind {
  if (/\.[cm]?tsx$/.test(path)) return ts.ScriptKind.TSX
  if (/\.jsx$/.test(path)) return ts.ScriptKind.JSX
  if (/\.[cm]?js$/.test(path)) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

// The identifier at the root of a call chain: test.each(t)('x') -> test.
function chainRoot(node: ts.Node): ts.Identifier | null {
  let current = node
  for (;;) {
    if (ts.isIdentifier(current)) return current
    if (ts.isTaggedTemplateExpression(current)) current = current.tag
    else if (
      ts.isPropertyAccessExpression(current) ||
      ts.isElementAccessExpression(current) ||
      ts.isCallExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isParenthesizedExpression(current)
    )
      current = current.expression
    else return null
  }
}

// An inner link of a longer chain (the `test.each(t)` of `test.each(t)('x', fn)`): only the outermost call counts.
function isChainLink(node: ts.CallExpression): boolean {
  const parent = node.parent
  return (
    (ts.isCallExpression(parent) && parent.expression === node) ||
    ((ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) && parent.expression === node) ||
    (ts.isTaggedTemplateExpression(parent) && parent.tag === node)
  )
}

function isExpectCall(node: ts.CallExpression): boolean {
  const callee = node.expression
  if (ts.isIdentifier(callee)) return callee.text === 'expect'
  return (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) &&
    callee.expression.text === 'expect' &&
    (callee.name.text === 'soft' || callee.name.text === 'poll')
  )
}

function titleOf(arg: ts.Expression | undefined): string | null {
  if (arg === undefined) return null
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return arg.text
  if (ts.isTemplateExpression(arg))
    return arg.head.text + arg.templateSpans.map((span) => '${}' + span.literal.text).join('')
  return null
}

// The statement a declaration lives in (or the body expression of an arrow function).
function enclosingStatement(node: ts.Node): ts.Node {
  let current = node
  while (current.parent) {
    const parent = current.parent
    if (
      ts.isSourceFile(parent) ||
      ts.isBlock(parent) ||
      ts.isModuleBlock(parent) ||
      ts.isCaseClause(parent) ||
      ts.isDefaultClause(parent)
    )
      break
    if (ts.isArrowFunction(parent) && parent.body === current) break
    current = parent
  }
  return current
}

function headerProblem(file: ts.SourceFile, node: ts.Node): string | null {
  const text = file.text
  const statement = enclosingStatement(node)
  const start = statement.getStart(file)
  const startLine = file.getLineAndCharacterOfPosition(start).line
  const lineStart = file.getPositionOfLineAndCharacter(startLine, 0)
  if (text.slice(lineStart, start).trim() !== '') return 'must start its own line, with a comment directly above it'
  const comments = ts.getLeadingCommentRanges(text, statement.getFullStart()) ?? []
  const last = comments[comments.length - 1]
  if (last !== undefined && file.getLineAndCharacterOfPosition(last.end).line === startLine - 1) {
    // A declaration deeper inside a multi-line statement (or one that ASI glued to the previous call) needs its own comment.
    const declLine = file.getLineAndCharacterOfPosition(node.getStart(file)).line
    if (declLine === startLine) return null
    const above = text
      .slice(file.getPositionOfLineAndCharacter(declLine - 1, 0), file.getPositionOfLineAndCharacter(declLine, 0))
      .trim()
    return above.startsWith('//') || above.endsWith('*/')
      ? null
      : 'is inside a longer statement and has no comment directly above it'
  }
  return 'has no comment directly above it (// Protects: ...)'
}

export function parseTestFile(path: string, source: string): ParsedFile {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, scriptKind(path))
  // parseDiagnostics is not in the public typings but is the parser's own syntax error list.
  const diagnostics = (file as unknown as { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics
  const declarations: Declaration[] = []
  let expects = 0
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const root = chainRoot(node.expression)
      if (isExpectCall(node)) expects++
      if (root !== null && (root.text === 'test' || root.text === 'it') && !isChainLink(node)) {
        const arg = node.arguments[0]
        const title = titleOf(arg)
        declarations.push({
          line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
          title,
          key: title ?? `\u0000${arg === undefined ? 'no title' : arg.getText(file)}`,
          headerProblem: headerProblem(file, node),
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  const first = diagnostics[0]
  const error =
    first === undefined
      ? null
      : `line ${file.getLineAndCharacterOfPosition(first.start ?? 0).line + 1}: ${ts.flattenDiagnosticMessageText(first.messageText, ' ')}`
  return { ok: diagnostics.length === 0, error, declarations, expects }
}
