import { expect, test } from 'vitest'
import { guard } from './helpers'

// Protects: only whole numbers from 0 are a version.
test('[C4] case-and-whitespace: strings, booleans and objects are not versions', () => {
  for (const value of [' 3', '0', true, false, [], [1], {}, { valueOf: () => 1 }, '']) {
    expect(guard.parseSentVersion(value)).toBeNull()
  }
})

// Protects: the edges of the number range.
test('[C4] empty-one-huge: infinities, -0.5 and large whole numbers', () => {
  expect(guard.parseSentVersion(Infinity)).toBeNull()
  expect(guard.parseSentVersion(-Infinity)).toBeNull()
  expect(guard.parseSentVersion(-0.5)).toBeNull()
  expect(guard.parseSentVersion(0.0000001)).toBeNull()
  expect(guard.parseSentVersion(1)).toBe(1)
  expect(guard.parseSentVersion(1_000_000)).toBe(1_000_000)
})
