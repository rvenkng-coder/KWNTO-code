// Checks docs 8b.7: markdown links in the docs must resolve.
// Run directly (node scripts/check-doc-links.ts) it checks every git-tracked
// *.md outside .agents/, .claude/ and node_modules/, prints
// `file: broken link <target>` per problem and exits 1 if any.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { isMain } from './lib/is-main.ts'

/**
 * Given a markdown string, a base directory, and an `exists` predicate,
 * returns the list of broken relative link targets (file part only, no anchor).
 */
export function findBrokenLinks(
  markdown: string,
  fileDir: string,
  exists: (absolutePath: string) => boolean,
): string[] {
  // Strip fenced code blocks first (``` ... ``` on their own lines)
  const withoutFences = markdown.replace(/```[a-z]*\n[\s\S]*?\n```/g, '')

  const broken: string[] = []

  // Match markdown links: [text](url)
  for (const match of withoutFences.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)) {
    const url = match[2]

    // Skip external URLs and mailto:
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) continue

    // Strip anchor
    const [pathPart] = url.split('#', 2)
    if (!pathPart) continue

    // Decode URI encoding (e.g. %20 → space)
    const decoded = decodeURIComponent(pathPart)

    // Resolve relative to the file's directory
    const absolute = resolve(join(fileDir, decoded))

    if (!exists(absolute)) {
      broken.push(pathPart)
    }
  }

  return broken
}

function markdownFiles(): string[] {
  try {
    const out = execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' })
    return out
      .split('\n')
      .filter((f) => f.trim())
      .filter(
        (f) =>
          !f.startsWith('.agents/') &&
          !f.startsWith('.claude/') &&
          !f.startsWith('.planning/') &&
          !f.startsWith('node_modules/'),
      )
  } catch {
    // git ls-files failed — nothing tracked yet
    return []
  }
}

if (isMain(import.meta.filename)) {
  let problems = 0
  for (const file of markdownFiles()) {
    const abs = resolve(file)
    const content = readFileSync(abs, 'utf8')
    const broken = findBrokenLinks(content, dirname(abs), (p) => existsSync(p) && statSync(p).isFile())
    for (const target of broken) {
      console.log(`${file}: broken link ${target}`)
      problems++
    }
  }
  process.exit(problems > 0 ? 1 : 0)
}
