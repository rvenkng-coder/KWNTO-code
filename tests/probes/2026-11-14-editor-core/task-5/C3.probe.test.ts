import { expect, test } from 'vitest'
import { guard, readers } from './helpers'

// Protects: id, version, created and updated are never written by the guard, even all at once.
test('[C3] two-bad-items: id, version, created and updated all differ and none is listed', () => {
  const [read, orig] = readers(
    { id: 'b', version: 9, created: 'x2', updated: 'y2', title: 't' },
    { id: 'a', version: 1, created: 'x1', updated: 'y1', title: 't' },
  )
  expect(guard.changedFields(['id', 'version', 'created', 'updated', 'title'], read, orig)).toEqual([])
})

// Protects: a skipped name is skipped only exactly; a similar real field is still compared.
test('[C3] case-and-whitespace: fields named like skipped ones are still compared', () => {
  const [read, orig] = readers({ Version: 2, versions: 2, updated_by: 'b' }, { Version: 1, versions: 1, updated_by: 'a' })
  expect(guard.changedFields(['Version', 'versions', 'updated_by'], read, orig).sort()).toEqual(['Version', 'updated_by', 'versions'])
})
