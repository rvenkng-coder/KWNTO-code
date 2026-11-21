import { expect, test } from 'vitest'
import { acceptFor } from '../../../../frontend/src/features/editor/media/uploadCheck.ts'

// Probes are written from the Cases and the catalogue, with inputs the task's own tests do not use.
// Written by the same author as the code (native execution), after the code: weaker than a sealed probe.

// Protects: the order of the list does not depend on the order of the setting.
test('[C1] boundary-inputs: the accept list follows the fixed order whatever order the setting has', () => {
  expect(acceptFor(['png', 'jpeg', 'mp4', 'wav'])).toBe('.wav,.mp4,.jpg,.jpeg,.png')
})

// Protects: video can be off while audio stays.
test('[C2] boundary-inputs: one type on gives only its extensions', () => {
  expect(acceptFor(['mp3'])).toBe('.mp3')
  expect(acceptFor(['jpeg'])).toBe('.jpg,.jpeg')
})

// Protects: an unknown or duplicate entry in the setting never invents an extension.
test('[C3] error-paths: unknown and duplicate entries are ignored', () => {
  expect(acceptFor(['gif', 'exe'])).toBe('')
  expect(acceptFor(['wav', 'wav', 'gif'])).toBe('.wav')
})
