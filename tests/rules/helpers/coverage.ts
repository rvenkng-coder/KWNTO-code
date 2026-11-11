export type CollectionRules = {
  name: string
  system: boolean
  listRule: string | null
  viewRule: string | null
  createRule?: string | null
  updateRule?: string | null
  deleteRule?: string | null
}

export const PUBLIC_RULES: readonly string[] = ['users.createRule']

const RULE_NAMES = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule'] as const

export function findCoverageProblems(
  collections: CollectionRules[],
  testFileNames: string[],
  publicRules: readonly string[],
): string[] {
  const problems: string[] = []

  for (const col of collections) {
    if (col.system) {
      continue
    }

    const expectedFile = `${col.name}.rules.test.ts`
    if (!testFileNames.includes(expectedFile)) {
      problems.push(`${col.name}: no rule test file (expected tests/rules/${expectedFile})`)
    }

    for (const rule of RULE_NAMES) {
      if (col[rule] === '') {
        const fullRule = `${col.name}.${rule}`
        if (!publicRules.includes(fullRule)) {
          problems.push(`${fullRule} is public ("") and not in PUBLIC_RULES`)
        }
      }
    }
  }

  return problems
}
