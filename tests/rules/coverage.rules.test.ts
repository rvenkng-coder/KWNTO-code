import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'
import { type CollectionRules, findCoverageProblems, PUBLIC_RULES } from './helpers/coverage.ts'
import { asAdmin } from './helpers/pb.ts'

test('every collection has a rule test and no unplanned public rule', async () => {
  const admin = await asAdmin()
  const collections = await admin.collections.getFullList()
  const rulesDir = path.resolve(import.meta.dirname, '.')
  const files = fs.readdirSync(rulesDir).filter((f) => f.endsWith('.rules.test.ts'))
  expect(findCoverageProblems(collections as unknown as CollectionRules[], files, PUBLIC_RULES)).toEqual([])
})
