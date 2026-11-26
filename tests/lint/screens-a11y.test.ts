// Protects: link-style navigation must use buttons for keyboard accessibility.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

function collectTsxFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isFile() && entry.name.endsWith('.tsx')) {
      results.push(full)
    } else if (entry.isDirectory()) {
      results.push(...collectTsxFiles(full))
    }
  }
  return results
}

const featureFiles = collectTsxFiles('frontend/src/features')

// A control that acts on the screen must be a real button for keyboard users, not an empty `href="#"` link.
test('no feature screen uses a link as a button', () => {
  const violations: string[] = []
  for (const file of featureFiles) {
    const code = readFileSync(file, 'utf-8')
    if (code.includes('href="#"')) {
      violations.push(file)
    }
  }
  expect(violations).toEqual([])
})

// role="alert" makes a screen reader announce a form error when it appears.
test('every form error is announced', () => {
  const violations: string[] = []
  for (const file of featureFiles) {
    const code = readFileSync(file, 'utf-8')
    // Find all form-error elements and check they have role="alert"
    const lines = code.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('data-testid="form-error"')) {
        if (!lines[i].includes('role="alert"')) {
          violations.push(`${file}:${i + 1}`)
        }
      }
    }
  }
  expect(violations).toEqual([])
})
