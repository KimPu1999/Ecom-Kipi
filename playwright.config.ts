import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { outputFolder: 'artifacts/playwright' }], ['junit', { outputFile: 'artifacts/playwright-junit.xml' }]] : 'list',
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : undefined },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
