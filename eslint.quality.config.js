// Readability limits for changed source files (docs/developer/quality-limits.md). Used only by
// scripts/check-changed-quality.ts, never by `npm run lint`: it reuses the parsers of eslint.config.js
// but none of its rules, so old code that breaks a limit does not fail the normal lint.
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const limits = {
  complexity: ['error', 10],
  'max-depth': ['error', 4],
  'max-params': ['error', 5],
  'no-debugger': 'error',
}
const functionLength = (max) => ['error', { max, skipBlankLines: true, skipComments: true }]

export default defineConfig([
  globalIgnores(['dist', 'spike', '.agents', '.claude', 'branching_narrative_tool.tsx', '**/node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser, ecmaVersion: 2023, globals: globals.browser },
    rules: { ...limits, 'max-lines-per-function': functionLength(50) },
  },
  {
    // A React component holds its markup, so it gets more room.
    files: ['**/*.tsx'],
    rules: { 'max-lines-per-function': functionLength(80) },
  },
  {
    // PocketBase hooks are CommonJS (backend/pb_hooks/package.json).
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs' },
    rules: { ...limits, 'max-lines-per-function': functionLength(50) },
  },
  {
    // Scripts print by design; the app and the hooks use the app's own error paths.
    files: ['src/**/*.{ts,tsx,js}', 'backend/pb_hooks/**/*.js'],
    rules: { 'no-console': 'error' },
  },
])
