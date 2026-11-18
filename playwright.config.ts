import { defineConfig, devices } from '@playwright/test'

const PERF = /editor-performance\.spec\.ts/

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
  },
  // The canvas performance spec (3 s budget, decision 0003) runs alone, after every other test
  // and one browser at a time: next to three other workers it measured machine load, not the
  // app (editor core plan, Task 14 report). Alone: `--project perf-firefox --no-deps`.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: PERF },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: PERF },
    { name: 'perf-chromium', use: { ...devices['Desktop Chrome'] }, testMatch: PERF, dependencies: ['chromium', 'firefox'] },
    { name: 'perf-firefox', use: { ...devices['Desktop Firefox'] }, testMatch: PERF, dependencies: ['perf-chromium'] },
  ],
})
