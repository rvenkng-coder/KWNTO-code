// Protects design 6.7: an unreachable or refusing backend is a normal state the UI reports,
// and the rule that screens never see SDK types.
import { expect, test } from 'vitest'
import { toBackendError } from './errors'
import { ClientResponseError } from 'pocketbase'

test('status 0 -> unreachable', () => {
  const err = toBackendError(new ClientResponseError({ status: 0, response: {} }))
  expect(err.kind).toBe('unreachable')
})

test('status 400 with field message -> invalid with fields', () => {
  const err = toBackendError(new ClientResponseError({
    status: 400,
    response: { data: { password: { message: 'Use at least 10 characters.' } } },
  }))
  expect(err.kind).toBe('invalid')
  expect(err.fields.password).toBe('Use at least 10 characters.')
})

test('status 429 -> locked with server message', () => {
  const err = toBackendError(new ClientResponseError({
    status: 429,
    response: { message: 'Too many failed sign-in attempts. Try again after 5 minutes.' },
  }))
  expect(err.kind).toBe('locked')
  expect(err.message).toBe('Too many failed sign-in attempts. Try again after 5 minutes.')
})

test('status 403 -> forbidden', () => {
  const err = toBackendError(new ClientResponseError({
    status: 403,
    response: { message: 'Access denied.' },
  }))
  expect(err.kind).toBe('forbidden')
})

test('status 404 -> not-found', () => {
  const err = toBackendError(new ClientResponseError({
    status: 404,
    response: { message: 'Not found.' },
  }))
  expect(err.kind).toBe('not-found')
})

test('status 409 -> conflict', () => {
  const err = toBackendError(new ClientResponseError({
    status: 409,
    response: { message: 'Conflict.' },
  }))
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
