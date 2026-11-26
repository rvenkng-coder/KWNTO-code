// Run directly: `npm run check:comments [-- <path>...]` lists comments that point at old project history;
// `npm run check:comments -- --same-code <base>` lists changed files whose code, comments aside, differs.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { changedFiles, fileAtBase, repoRoot } from './lib/changed-files.ts'
import { codeWithoutComments, findHistoryRefs } from './lib/comment-refs.ts'
import { isMain } from './lib/is-main.ts'

const ROOTS = ['frontend/src', 'backend/pb_hooks', 'e2e', 'tests', 'scripts']

// Probe files and migrations are records of what ran; their comments are not rewritten.
export function inScope(path: string): boolean {
  return (
    /\.(ts|tsx|js)$/.test(path) &&
    !path.startsWith('tests/probes/') &&
    ROOTS.some((root) => path === root || path.startsWith(`${root}/`))
  )
}

function listRefs(root: string, paths: string[]): string[] {
  const listed = execFileSync('git', ['ls-files', '-z', '--', ...(paths.length > 0 ? paths : ROOTS)], {
    cwd: root,
    encoding: 'utf8',
  })
  const files = listed.split('\0').filter(inScope)
  if (files.length === 0)
    throw new Error(`no code file to check under: ${(paths.length > 0 ? paths : ROOTS).join(' ')}`)
  return files.flatMap((path) =>
    findHistoryRefs(path, readFileSync(join(root, path), 'utf8')).map((r) => `${path}:${r.line}: ${r.match}`),
  )
}

// A file that was added, deleted or renamed has no pair to compare, so it counts as different.
function listCodeChanges(root: string, base: string): string[] {
  return changedFiles(base, root)
    .filter((change) => inScope(change.path) || (change.oldPath !== undefined && inScope(change.oldPath)))
    .flatMap((change) => {
      if (change.status !== 'modified') return [`${change.path}: ${change.status}`]
      const before = fileAtBase(base, change.path, root) as string
      const after = readFileSync(join(root, change.path), 'utf8')
      const same = codeWithoutComments(change.path, before) === codeWithoutComments(change.path, after)
      return same ? [] : [`${change.path}: code differs`]
    })
}

if (isMain(import.meta.filename)) {
  const args = process.argv.slice(2)
  const root = repoRoot()
  const sameCode = args[0] === '--same-code'
  const found = sameCode ? listCodeChanges(root, args[1] ?? '') : listRefs(root, args)
  for (const line of found) console.log(line)
  const what = sameCode ? 'file(s) with a code change' : 'history reference(s)'
  console.log(found.length === 0 ? 'check:comments: ok' : `check:comments: ${found.length} ${what}`)
  process.exit(found.length === 0 ? 0 : 1)
}
