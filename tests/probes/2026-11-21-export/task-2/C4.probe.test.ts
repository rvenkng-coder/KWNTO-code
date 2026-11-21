import { expect, test } from 'vitest'
import { buildDocx, buildPdf } from '../../../../frontend/src/features/editor/export/documents'
import { map } from './helpers'

// Protects: the refusal is an Error, and one valid map is not refused.
test('[C4] empty-one-huge: empty list refused, one map accepted', async () => {
  await expect(buildPdf('', [])).rejects.toBeInstanceOf(Error)
  await expect(buildDocx('', [])).rejects.toBeInstanceOf(Error)
  await expect(buildPdf('', [map('x', 1, 1)])).resolves.toBeInstanceOf(Blob)
  await expect(buildDocx('', [map('x', 1, 1)])).resolves.toBeInstanceOf(Blob)
})
