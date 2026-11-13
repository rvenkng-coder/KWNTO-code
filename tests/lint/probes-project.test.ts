import { matchesGlob } from 'node:path'
import { describe, expect, test } from 'vitest'
import { containerConfig, probesConfig, rulesConfig, unitConfig } from '../../vitest.config.ts'

// A project matches a file when an include glob matches and no exclude glob does.
function matches(config: { test?: { include?: string[]; exclude?: string[] } }, path: string): boolean {
  const { include = [], exclude = [] } = config.test ?? {}
  return include.some((glob) => matchesGlob(path, glob)) && !exclude.some((glob) => matchesGlob(path, glob))
}

describe('the probes project', () => {
  // Protects: probes run only under `probes`, so an implementer's `npm test` never sees them.
  test('tests/probes/x/y/a.probe.test.ts is matched by probes and by no other project', () => {
    const path = 'tests/probes/x/y/a.probe.test.ts'
    expect(matches(probesConfig, path)).toBe(true)
    for (const other of [unitConfig, rulesConfig, containerConfig]) expect(matches(other, path)).toBe(false)
  })

  // Protects: the exclusion is not so wide that it hides ordinary tests from their projects.
  test('an ordinary unit test is still matched by unit and not by probes', () => {
    expect(matches(unitConfig, 'scripts/lib/a.test.ts')).toBe(true)
    expect(matches(probesConfig, 'scripts/lib/a.test.ts')).toBe(false)
  })

  // Protects: a probe filed under another project's folder is still kept out of that project.
  test('a probe file under tests/rules or tests/container is excluded from those projects', () => {
    expect(matches(rulesConfig, 'tests/rules/a.probe.test.ts')).toBe(false)
    expect(matches(containerConfig, 'tests/container/a.probe.test.ts')).toBe(false)
    expect(matches(unitConfig, 'src/a.probe.test.ts')).toBe(false)
  })
})
