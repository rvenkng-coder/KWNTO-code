import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'spike', '.agents', '.claude', 'branching_narrative_tool.tsx']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
  },
  {
    // Guardrails from docs/engineering.md section 2 and docs/security.md section 5.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': ['error', {
        paths: [{ name: 'pocketbase', message: 'Only src/backend/ may import pocketbase (docs/engineering.md section 2).' }],
      }],
      'no-restricted-syntax': ['error', {
        selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
        message: 'Plain text only (docs/security.md section 5).',
      }],
    },
  },
  {
    // The one door to the backend, and the tests that talk to it directly.
    files: ['src/backend/**', 'tests/rules/**', 'e2e/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
])
