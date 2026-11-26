import { describe, expect, test } from 'vitest'
import { isBreakablePath, parseTaskMeta, parseTestPlan } from './test-plan.ts'

const CASES = [
  '| ID | Behaviour | Layer | Input | Expected | Test |',
  '|---|---|---|---|---|---|',
  '| C1 | empty input | unit | `f("")` | `[]` | scripts/x.test.ts :: empty input |',
]
const BREAKS = [
  '| ID | File | Find | Replace | Tests |',
  '|---|---|---|---|---|',
  '| B1 | scripts/x.ts | `a < b` | `a <= b` | scripts/x.test.ts |',
]

interface Parts {
  cases?: string[]
  probes?: string[]
  breaks?: string[]
  flow?: string[]
  evidence?: string[]
}

function block(parts: Parts = {}): string {
  return [
    '# Task',
    '',
    '## Test plan',
    '### Cases',
    ...(parts.cases ?? CASES),
    '### Probes',
    ...(parts.probes ?? ['**Probe folder:** `tests/probes/p/t/`']),
    '### Breaks',
    ...(parts.breaks ?? BREAKS),
    '### Flow',
    ...(parts.flow ?? ['none']),
    '### Evidence',
    ...(parts.evidence ?? ['paste the check output']),
  ].join('\n')
}

describe('parseTestPlan', () => {
  // Protects the format contract: a complete block is read into cases, probe folder, breaks, flow, evidence.
  test('parses a full block', () => {
    const { plan, problems } = parseTestPlan(block())
    expect(problems).toEqual([])
    expect(plan).toEqual({
      cases: [
        {
          id: 'C1',
          behaviour: 'empty input',
          layer: 'unit',
          input: 'f("")',
          expected: '[]',
          test: 'scripts/x.test.ts :: empty input',
        },
      ],
      probeFolder: 'tests/probes/p/t/',
      breaks: [{ id: 'B1', file: 'scripts/x.ts', find: 'a < b', replace: 'a <= b', tests: ['scripts/x.test.ts'] }],
      flow: 'none',
      evidence: 'paste the check output',
    })
  })

  // Protects Review Focus 4: a task without the block must not be read as "no cases, all fine".
  test('a missing Test plan heading gives plan null', () => {
    const result = parseTestPlan('# Task\n\nNo plan here.\n')
    expect(result.plan).toBeNull()
    expect(result.problems.length).toBeGreaterThan(0)
  })

  // Protects Review Focus 4: an empty table is a problem, never zero cases passing silently.
  test('a table with no rows gives a problem (not zero cases silently)', () => {
    const { problems } = parseTestPlan(block({ cases: CASES.slice(0, 2) }))
    expect(problems.join('\n')).toMatch(/Cases.*no rows/)
  })

  // Protects the layer names of docs/testing-strategy.md section 2: a typo must not pass.
  test('an unknown layer is a problem', () => {
    const cases = [...CASES.slice(0, 2), CASES[2].replace('| unit |', '| integration |')]
    expect(parseTestPlan(block({ cases })).problems.join('\n')).toMatch(/C1.*layer.*integration/)
  })

  // Protects coverage: a non-manual case with no test (or a malformed reference) can never be proved.
  test('a case row without a test reference is a problem unless the layer is manual', () => {
    const noTest = [...CASES.slice(0, 2), '| C1 | b | unit | i | e |  |']
    expect(parseTestPlan(block({ cases: noTest })).problems.join('\n')).toMatch(/C1.*test/)
    const noTitle = [...CASES.slice(0, 2), '| C1 | b | unit | i | e | scripts/x.test.ts |']
    expect(parseTestPlan(block({ cases: noTitle })).problems.join('\n')).toMatch(/C1.*path :: title/)
    const manual = [...CASES.slice(0, 2), '| C1 | b | manual | i | e |  |']
    expect(parseTestPlan(block({ cases: manual })).problems).toEqual([])
  })

  // Protects row addressing: reports and breaks name a row by id, so ids must be unique.
  test('duplicate case ids are a problem', () => {
    const cases = [...CASES, CASES[2]]
    expect(parseTestPlan(block({ cases })).problems.join('\n')).toMatch(/C1.*duplicate/)
  })

  // Protects the breaks runner: an empty Find would match everywhere or nowhere.
  test('a break with empty Find is a problem', () => {
    const breaks = [...BREAKS.slice(0, 2), '| B1 | scripts/x.ts |  | `a <= b` | scripts/x.test.ts |']
    expect(parseTestPlan(block({ breaks })).problems.join('\n')).toMatch(/B1.*Find/)
  })

  // Protects design 6.3: breaks apply only to code Vitest reaches.
  test('a break whose file is outside frontend/src/, scripts/, backend/pb_hooks/lib/ is a problem', () => {
    const breaks = [...BREAKS.slice(0, 2), '| B1 | e2e/x.ts | `a` | `b` | scripts/x.test.ts |']
    expect(parseTestPlan(block({ breaks })).problems.join('\n')).toMatch(/B1.*File/)
  })

  // Protects design 6.3 and Task 5: the one shared rule for what a break may touch.
  test('isBreakablePath accepts frontend/src/a.ts, scripts/x.ts, backend/pb_hooks/lib/y.js and rejects tests/x.ts, frontend/src/a.test.ts, ../x.ts, /etc/passwd, backend/pb_hooks/users-signup.pb.js (a hook is covered by rule tests, design 6.3)', () => {
    for (const ok of ['frontend/src/a.ts', 'scripts/x.ts', 'backend/pb_hooks/lib/y.js'])
      expect(isBreakablePath(ok), ok).toBe(true)
    const bad = [
      'tests/x.ts',
      'frontend/src/a.test.ts',
      '../x.ts',
      '/etc/passwd',
      'backend/pb_hooks/users-signup.pb.js',
      'frontend/src/../tests/x.ts',
      'src\\..\\x.ts',
      '',
    ]
    for (const path of bad) expect(isBreakablePath(path), path).toBe(false)
  })

  // Protects multi-test breaks: one break may be caught by several tests.
  test("a break row's Tests cell may list several comma-separated paths", () => {
    const breaks = [...BREAKS.slice(0, 2), '| B1 | scripts/x.ts | `a` | `b` | scripts/x.test.ts, scripts/y.test.ts |']
    const { plan, problems } = parseTestPlan(block({ breaks }))
    expect(problems).toEqual([])
    expect(plan?.breaks[0].tests).toEqual(['scripts/x.test.ts', 'scripts/y.test.ts'])
  })

  // Protects docs/testing-strategy.md section 8: probes live under tests/probes/ and nowhere else.
  test('the probe folder must start with tests/probes/', () => {
    expect(parseTestPlan(block({ probes: ['**Probe folder:** `tests/x/`'] })).problems.join('\n')).toMatch(
      /Probes.*tests\/probes\//,
    )
    expect(parseTestPlan(block({ probes: ['no folder line'] })).problems.join('\n')).toMatch(/Probes/)
  })

  // Protects the evidence rule: a task with no Flow decision or no Evidence request is incomplete.
  test('Flow and Evidence sections must not be empty', () => {
    const problems = parseTestPlan(block({ flow: [''], evidence: ['  '] })).problems.join('\n')
    expect(problems).toMatch(/Flow.*empty/)
    expect(problems).toMatch(/Evidence.*empty/)
  })

  // Protects Review Focus 4: a misspelled or misplaced section must be reported, not ignored.
  test('sections out of order or misspelled (### Case, ### Breaks ) are problems, not ignored', () => {
    const misspelled = block().replace('### Cases', '### Case')
    expect(parseTestPlan(misspelled).problems.join('\n')).toMatch(/### Case\b.*unknown|unknown.*### Case\b/)
    expect(parseTestPlan(misspelled).problems.join('\n')).toMatch(/missing.*Cases/)
    const swapped = block()
      .replace('### Flow', '### Tmp')
      .replace('### Evidence', '### Flow')
      .replace('### Tmp', '### Evidence')
    expect(parseTestPlan(swapped).problems.join('\n')).toMatch(/order/)
  })

  // Protects Find/Replace fidelity: backticks inside a cell stay, and \| becomes a literal pipe.
  test('cells keep inner backticks and pipes escaped as \\|', () => {
    const breaks = [...BREAKS.slice(0, 2), '| B1 | scripts/x.ts | `a \\|\\| `b`` | `a && b` | scripts/x.test.ts |']
    const { plan, problems } = parseTestPlan(block({ breaks }))
    expect(problems).toEqual([])
    expect(plan?.breaks[0].find).toBe('a || `b`')
  })

  // Protects the task template: a whole-line HTML comment explains a part and is not content (a comment-only Flow is still empty).
  test('whole-line HTML comments are ignored', () => {
    const withComments = block()
      .replace('### Cases', '<!-- what Cases are -->\n### Cases')
      .replace('### Flow', '### Flow\n<!-- note -->')
    expect(parseTestPlan(withComments)).toEqual(parseTestPlan(block()))
    expect(parseTestPlan(block({ flow: ['<!-- only a comment -->'] })).problems.join('\n')).toMatch(/Flow.*empty/)
  })

  // Protects Task 5's contract: a task with no unit case may list no breaks (`none`), in any case or spacing.
  test('Breaks none with only rules, e2e and manual cases passes', () => {
    const cases = [
      ...CASES.slice(0, 2),
      '| C1 | b | rules | i | e | tests/rules/a.rules.test.ts :: t |',
      '| C2 | b | manual | i | e |  |',
    ]
    for (const none of ['none', '  None  ', 'NONE']) {
      const { plan, problems } = parseTestPlan(block({ cases, breaks: [none] }))
      expect(problems).toEqual([])
      expect(plan?.breaks).toEqual([])
    }
  })

  // Protects the breaks gate: a unit case with `none` breaks would let decision code go unbroken.
  test('Breaks none with a unit case is a problem naming the unit row', () => {
    const cases = [
      ...CASES,
      '| C2 | b | unit | i | e | scripts/x.test.ts :: t |',
      '| C3 | b | e2e | i | e | e2e/a.spec.ts :: t |',
    ]
    const problems = parseTestPlan(block({ cases, breaks: ['none'] })).problems.join('\n')
    expect(problems).toMatch(/Breaks.*none.*C1, C2/)
    expect(problems).not.toMatch(/C3/)
  })

  // Protects Review Focus 4: a Breaks header with no rows and no `none` is still not read as "no breaks".
  test('an empty Breaks table without none is a problem', () => {
    expect(parseTestPlan(block({ breaks: BREAKS.slice(0, 2) })).problems.join('\n')).toMatch(/Breaks.*no rows/)
    expect(parseTestPlan(block({ breaks: ['none', ...BREAKS] })).problems.join('\n')).toMatch(/Breaks/)
  })

  // Protects Review Focus 4: an empty Probes section is a problem, not "no probes".
  test('an empty Probes section is a problem', () => {
    expect(parseTestPlan(block({ probes: [''] })).problems.join('\n')).toMatch(/Probes.*Probe folder/)
  })

  // Documents the choice: trailing spaces after a ### heading (CRLF leftovers, editors) are harmless.
  test('a section heading with a trailing space is accepted', () => {
    expect(parseTestPlan(block().replace('### Breaks', '### Breaks ')).problems).toEqual([])
  })

  // Protects Windows checkouts: CRLF files must give the same result as LF.
  test('Windows line endings parse the same', () => {
    expect(parseTestPlan(block().replaceAll('\n', '\r\n'))).toEqual(parseTestPlan(block()))
  })
})

describe('parseTaskMeta', () => {
  // Protects the tier and Interfaces gates of check:plan.
  test('parseTaskMeta finds tier and Interfaces; a bad tier name gives null', () => {
    expect(parseTaskMeta('**Model tier:** local  \n**Interfaces:** none\n')).toEqual({
      tier: 'local',
      hasInterfaces: true,
    })
    expect(parseTaskMeta('**Model tier:** mid\n')).toEqual({ tier: 'mid', hasInterfaces: false })
    expect(parseTaskMeta('**Model tier:** weak\n**Interfaces:** x').tier).toBeNull()
    expect(parseTaskMeta('# nothing\n')).toEqual({ tier: null, hasInterfaces: false })
  })
})
