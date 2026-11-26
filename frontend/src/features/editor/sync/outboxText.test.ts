import { expect, test } from 'vitest'
import { failedText, fieldLabel, nextDelay, statusText } from './outboxText'

// Protects: the retry delay doubles from one second and never exceeds thirty.
test('backoff doubles from one second and stops at thirty', () => {
  expect([0, 1, 2, 3, 5, 6, 7, 50].map(nextDelay)).toEqual([1000, 1000, 2000, 4000, 16000, 30000, 30000, 30000])
})

// Protects: the status and failed words count changes and pluralise correctly.
test('the status words count changes', () => {
  expect(statusText(false, 0)).toBe('Offline')
  expect(statusText(false, 1)).toBe('Offline, 1 change waiting')
  expect(statusText(false, 12)).toBe('Offline, 12 changes waiting')
  expect(statusText(true, 3)).toBe('Saving…')
  expect(statusText(true, 0)).toBeNull()
  expect(failedText(1)).toBe('1 change could not be saved')
  expect(failedText(4)).toBe('4 changes could not be saved')
})

// Protects: the conflict dialog and failed list name fields in the person's words (x and y are one "Position").
test('each field has a readable label', () => {
  expect(fieldLabel('nodes', 'x')).toBe('Position')
  expect(fieldLabel('nodes', 'y')).toBe('Position')
  expect(fieldLabel('nodes', 'color')).toBe('Colour')
  expect(fieldLabel('connections', 'label')).toBe('Choice text')
  expect(fieldLabel('connections', 'toNodeId')).toBe('Choice target')
  expect(fieldLabel('cues', 'type')).toBe('Cue type')
  expect(fieldLabel('nodes', 'weird')).toBe('weird')
})
