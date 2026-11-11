// THROWAWAY: Playwright config for the real-time spike (Task 3).
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'spike*.spec.ts',
  // One test at a time: the measurements share one backend and must not disturb each other.
  workers: 1,
  fullyParallel: false,
  timeout: 300_000,
  reporter: 'list',
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
})
