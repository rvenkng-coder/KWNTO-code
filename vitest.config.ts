import { defineConfig, mergeConfig } from 'vitest/config'

const base = defineConfig({
  test: {
    environment: 'node',
  },
})

export const unitConfig = mergeConfig(base, defineConfig({
  test: {
    name: 'unit',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'tests/lint/**/*.test.ts', 'tests/rules/**/*.unit.test.ts', 'tests/hooks/**/*.unit.test.ts'],
  },
}))

export const rulesConfig = mergeConfig(base, defineConfig({
  test: {
    name: 'rules',
    include: ['tests/rules/**/*.test.ts'],
    exclude: ['tests/rules/**/*.unit.test.ts'],
    globalSetup: 'tests/rules/global-setup.ts',
    // Rule tests change global settings (registration_open, retention, later lockdown
    // and rate limits) and restore them afterwards; that is only safe when one file
    // runs at a time against the shared test backend.
    fileParallelism: false,
  },
}))

export const containerConfig = mergeConfig(base, defineConfig({
  test: {
    name: 'container',
    include: ['tests/container/**/*.test.ts'],
    testTimeout: 180_000,
  },
}))

export default defineConfig({
  test: {
    projects: [unitConfig, rulesConfig, containerConfig],
  },
})
