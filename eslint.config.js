import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// The names PocketBase's JavaScript engine gives a hook. A new one used in a hook is added here.
const POCKETBASE_GLOBALS = [
  '__hooks', '$app', '$apis', '$security', '$dbx', '$os', '$mails', '$filesystem', '$template', '$http',
  'routerAdd', 'routerUse', 'cronAdd', 'migrate', 'toString', 'toBytes', 'sleep', 'arrayOf', 'DynamicModel',
  'Record', 'Collection', 'MailerMessage', 'DateTime', 'ValidationError',
  'BadRequestError', 'ForbiddenError', 'NotFoundError', 'ApiError', 'UnauthorizedError',
  'Field', 'TextField', 'NumberField', 'SelectField', 'RelationField', 'DateField', 'JSONField', 'BoolField',
  'FileField', 'AutodateField', 'EmailField', 'URLField',
  'onBootstrap', 'onRecordCreate', 'onRecordUpdate', 'onRecordCreateRequest', 'onRecordUpdateRequest',
  'onFileDownloadRequest', 'onRecordAfterCreateSuccess', 'onRecordAfterUpdateSuccess',
  'onRecordAuthRequest', 'onRecordAuthWithPasswordRequest', 'onRecordConfirmPasswordResetRequest',
  'onRecordConfirmVerificationRequest',
]

export default defineConfig([
  globalIgnores(['dist', 'spike', '.agents', '.claude', 'branching_narrative_tool.tsx']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
  },
  {
    // Guardrails from docs/engineering.md section 2 and docs/security.md section 5.
    files: ['frontend/src/**/*.{ts,tsx}'],
    rules: {
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': ['error', {
        paths: [{ name: 'pocketbase', message: 'Only frontend/src/backend/ may import pocketbase (docs/engineering.md section 2).' }],
      }],
      'no-restricted-syntax': ['error', {
        selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
        message: 'Plain text only (docs/security.md section 5).',
      }],
    },
  },
  {
    // A test file lists many cases of one module; splitting it would scatter them (developer decision 2026-11-26).
    files: ['frontend/src/**/*.test.{ts,tsx}'],
    rules: { 'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }] },
  },
  {
    // PocketBase hooks: CommonJS run by PocketBase's own engine, so no typecheck covers them.
    files: ['backend/pb_hooks/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.commonjs, console: 'readonly', ...Object.fromEntries(POCKETBASE_GLOBALS.map((name) => [name, 'readonly'])) },
    },
    // The `no-console` disables in the hooks are read by eslint.quality.config.js, not here.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      // Keep `catch (error)`: the engine may not accept a `catch` without a binding.
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
    },
  },
  {
    // The one door to the backend, and the tests that talk to it directly.
    files: ['frontend/src/backend/**', 'tests/rules/**', 'e2e/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
])
