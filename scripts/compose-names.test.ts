import { readdirSync, readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

// Protects issue 25: a compose file used by tests has its own project name, so a test run's `down -v --remove-orphans`
// can never stop the dev backend (`compose.dev.yaml`, no name: it takes the folder's), and two test files never share one.
test('every test compose file has its own project name', () => {
  const root = new URL('..', import.meta.url)
  const files = readdirSync(root)
    .filter((f) => /^compose\..*test.*\.ya?ml$/.test(f))
    .sort()
  expect(files).toEqual(['compose.backup-test.yaml', 'compose.edge-test.yaml', 'compose.test.yaml'])
  const names = files.map((f) => /^name:\s*(\S+)\s*$/m.exec(readFileSync(new URL(f, root), 'utf8'))?.[1])
  expect(names.every((n) => n !== undefined && n !== '')).toBe(true)
  expect(new Set(names).size).toBe(files.length)
})
