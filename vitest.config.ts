import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'

// Probes are run only by `npm run check:probes`; no other project may pick them up.
const PROBES = '**/*.probe.test.ts'

const base = defineConfig({
  test: {
    environment: 'node',
  },
})

export const unitConfig = mergeConfig(base, defineConfig({
  test: {
    name: 'unit',
    include: ['frontend/src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'tests/lint/**/*.test.ts', 'tests/rules/**/*.unit.test.ts', 'tests/hooks/**/*.unit.test.ts'],
    exclude: [...configDefaults.exclude, PROBES],
  },
}))

export const rulesConfig = mergeConfig(base, defineConfig({
  test: {
    name: 'rules',
    include: ['tests/rules/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'tests/rules/**/*.unit.test.ts', PROBES],
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
    exclude: [...configDefaults.exclude, PROBES],
    testTimeout: 180_000,
  },
}))

export const probesConfig = mergeConfig(base, defineConfig({
  test: {
    name: 'probes',
    include: ['tests/probes/**/*.probe.test.ts'],
  },
}))

export default defineConfig({
  test: {
    projects: [unitConfig, rulesConfig, containerConfig, probesConfig],
  },
})
