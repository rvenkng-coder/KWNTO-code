import { defineConfig, mergeConfig } from 'vitest/config'

const base = defineConfig({
  test: {
    environment: 'node',
  },
})

export const unitConfig = mergeConfig(base, defineConfig({
  test: {
    name: 'unit',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'tests/lint/**/*.test.ts'],
  },
}))

export const rulesConfig = mergeConfig(base, defineConfig({
  test: {
    name: 'rules',
    include: ['tests/rules/**/*.test.ts'],
    globalSetup: 'tests/rules/global-setup.ts',
  },
}))

export const containerConfig = mergeConfig(base, defineConfig({
  test: {
    name: 'container',
    include: ['tests/container/**/*.test.ts'],
    testTimeout: 180_000,
  },
}))

export default unitConfig
