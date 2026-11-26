// Protects design 6.7: an unreachable or refusing backend is a normal state the UI reports,
// and the rule that screens never see SDK types.
import { expect, test } from 'vitest'
import { toBackendError } from './errors'
import { ClientResponseError } from 'pocketbase'

test('status 0 -> unreachable', () => {
  const err = toBackendError(new ClientResponseError({ status: 0, response: {} }))
  expect(err.kind).toBe('unreachable')
})

// Protects design 6.7: a stopped backend behind a proxy answers 502, 503 or 504 (or a bare 500 from the dev proxy), which is
// "cannot be reached" like status 0, so waiting edits are kept and retried instead of being refused and undone.
test('gateway errors and a bare proxy 500 -> unreachable, a real 500 with a message -> unknown', () => {
  for (const status of [502, 503, 504]) {
    expect(toBackendError(new ClientResponseError({ status, response: {} })).kind).toBe('unreachable')
  }
  expect(toBackendError(new ClientResponseError({ status: 500, response: {} })).kind).toBe('unreachable')
  const real = toBackendError(new ClientResponseError({ status: 500, response: { message: 'Something broke.' } }))
  expect(real.kind).toBe('unknown')
  expect(real.message).toBe('Something broke.')
})

test('status 400 with field message -> invalid with fields', () => {
  const err = toBackendError(
    new ClientResponseError({
      status: 400,
      response: { data: { password: { message: 'Use at least 10 characters.' } } },
    }),
  )
  expect(err.kind).toBe('invalid')
  expect(err.fields.password).toBe('Use at least 10 characters.')
})

test('status 429 -> locked with server message', () => {
  const err = toBackendError(
    new ClientResponseError({
      status: 429,
      response: { message: 'Too many failed sign-in attempts. Try again after 5 minutes.' },
    }),
  )
  expect(err.kind).toBe('locked')
  expect(err.message).toBe('Too many failed sign-in attempts. Try again after 5 minutes.')
})

test('status 403 -> forbidden', () => {
  const err = toBackendError(
    new ClientResponseError({
      status: 403,
      response: { message: 'Access denied.' },
    }),
  )
  expect(err.kind).toBe('forbidden')
})

test('status 404 -> not-found', () => {
  const err = toBackendError(
    new ClientResponseError({
      status: 404,
      response: { message: 'Not found.' },
    }),
  )
  expect(err.kind).toBe('not-found')
})

test('status 409 -> conflict', () => {
  const err = toBackendError(
    new ClientResponseError({
      status: 409,
      response: { message: 'Conflict.' },
    }),
  )
  expect(err.kind).toBe('conflict')
})

test('plain Error -> unknown', () => {
  const err = toBackendError(new Error('x'))
  expect(err.kind).toBe('unknown')
  expect(err.message).toBe('x')
})

test('undefined does not throw', () => {
  const err = toBackendError(undefined)
  expect(err.kind).toBe('unknown')
})
