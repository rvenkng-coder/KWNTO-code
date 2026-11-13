import { expect, test } from 'vitest'
import { errorMessage } from './errorMessage'

test('returns Error message when non-empty', () => {
  expect(errorMessage(new Error('boom'), 'fallback')).toBe('boom')
})

test('returns fallback when Error has empty message', () => {
  expect(errorMessage(new Error(''), 'fallback')).toBe('fallback')
})

test('returns fallback for a string', () => {
  expect(errorMessage('oops', 'fallback')).toBe('fallback')
})

test('returns fallback for null', () => {
  expect(errorMessage(null, 'fallback')).toBe('fallback')
})

test('returns fallback for object with message property that is not an Error', () => {
  expect(errorMessage({ message: 'not-an-error' }, 'fallback')).toBe('fallback')
})
