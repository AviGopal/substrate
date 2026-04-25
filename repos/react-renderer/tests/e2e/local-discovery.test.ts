/**
 * @local-only
 *
 * Local MiniBob integration test.
 * Requires: react-renderer running on :3000, discovery-vessel on :8080,
 * and ~/.metabob/config.json with metabob.apiKey set.
 *
 * Run with: bun test tests/e2e/local-discovery.test.ts
 * Skip gracefully when servers/config are absent.
 */
import { test, expect } from '@playwright/test'
import { homedir } from 'os'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'

const RENDERER_URL = 'http://localhost:3000'
const CONFIG_PATH = join(homedir(), '.metabob', 'config.json')

function hasValidConfig(): boolean {
  try {
    if (!existsSync(CONFIG_PATH)) return false
    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
    return !!(config?.metabob?.apiKey || config?.instance?.apiKey)
  } catch {
    return false
  }
}

async function isRendererRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${RENDERER_URL}/health`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

test.describe('@local-only Local MiniBob Integration', () => {
  test.beforeAll(async () => {
    if (!hasValidConfig()) {
      test.skip()
    }
    if (!(await isRendererRunning())) {
      test.skip()
    }
  })

  test('view page loads with empty state', async ({ page }) => {
    await page.goto(`${RENDERER_URL}/view`)
    await expect(page).toHaveTitle(/.+/)
  })

  test('POST to /impulses updates the view with a table', async ({ page }) => {
    await page.goto(`${RENDERER_URL}/view`)

    // POST a data-table impulse directly
    const res = await fetch(`${RENDERER_URL}/impulses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primitive: {
          type: 'data-table',
          columns: ['path', 'size', 'modified'],
          data: [
            { path: '/tmp/file1.txt', size: '100', modified: '2026-04-24' },
            { path: '/tmp/file2.ts', size: '200', modified: '2026-04-24' },
          ],
        },
      }),
    })
    expect(res.ok).toBe(true)

    // Wait for table to appear via WebSocket update
    await page.waitForSelector('table', { timeout: 5000 })
    await expect(page.locator('th').first()).toContainText('path')
    expect(await page.locator('tbody tr').count()).toBeGreaterThan(0)
  })
})
