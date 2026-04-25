import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  projects: [
    {
      name: 'unit',
      testMatch: /.*\.test\.ts$/,
      testIgnore: /.*\.e2e\.test\.ts$/,
    },
    {
      name: 'local-only',
      testMatch: /.*\.e2e\.test\.ts$/,
      grep: /@local-only/,
    },
  ],
  use: {
    headless: true,
    baseURL: 'http://localhost:3000',
  },
  timeout: 15000,
})
