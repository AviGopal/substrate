import { test, expect, type Page, type WebSocket } from '@playwright/test'

/**
 * Basic tests for Internal Dashboard
 *
 * Verifies core functionality:
 * - Page loads
 * - WebSocket connects
 * - Query input works
 * - Impulses render
 */

test.describe('Dashboard Basics', () => {
  test('page loads with query input', async ({ page }) => {
    await page.goto('/')

    // Wait for the page to load
    await expect(page.locator('body')).toBeVisible()

    // Query input should be visible (the main floating input at bottom)
    const queryInput = page.locator('.fixed.bottom-8 input[placeholder*="Ask"]')
    await expect(queryInput).toBeVisible()
  })

  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get('/health')
    expect(response.ok()).toBeTruthy()

    const body = await response.json()
    expect(body.status).toBe('ok')
  })
})

test.describe('WebSocket Connection', () => {
  test('connects to WebSocket and receives connected message', async ({ page }) => {
    // Track WebSocket messages
    const wsMessages: string[] = []

    // Listen for WebSocket connections
    page.on('websocket', ws => {
      ws.on('framereceived', frame => {
        if (typeof frame.payload === 'string') {
          wsMessages.push(frame.payload)
        }
      })
    })

    await page.goto('/')

    // Wait for connection
    await page.waitForTimeout(1000)

    // Check we received a connected message
    const connectedMessage = wsMessages.find(m => m.includes('"type":"connected"'))
    expect(connectedMessage).toBeTruthy()

    // Parse and verify
    const parsed = JSON.parse(connectedMessage!)
    expect(parsed.type).toBe('connected')
    expect(parsed.sessionId).toBeTruthy()
    expect(parsed.capabilities).toContain('query')
  })

  test('receives state_sync after connection', async ({ page }) => {
    const wsMessages: string[] = []

    page.on('websocket', ws => {
      ws.on('framereceived', frame => {
        if (typeof frame.payload === 'string') {
          wsMessages.push(frame.payload)
        }
      })
    })

    await page.goto('/')
    await page.waitForTimeout(1000)

    // Should receive state_sync with impulses
    const stateSyncMessage = wsMessages.find(m => m.includes('"type":"state_sync"'))
    expect(stateSyncMessage).toBeTruthy()

    const parsed = JSON.parse(stateSyncMessage!)
    expect(parsed.impulses).toBeDefined()
    expect(Array.isArray(parsed.impulses)).toBe(true)
  })
})

test.describe('Query Submission', () => {
  // Helper to get the main query input (the floating one at bottom)
  const getQueryInput = (page: Page) => page.locator('.fixed.bottom-8 input[placeholder*="Ask"]')

  test('can type in query input', async ({ page }) => {
    await page.goto('/')

    const queryInput = getQueryInput(page)
    await expect(queryInput).toBeVisible()

    await queryInput.fill('Show me the pods')
    await expect(queryInput).toHaveValue('Show me the pods')
  })

  test('submitting query sends WebSocket message', async ({ page }) => {
    const sentMessages: string[] = []

    // Set up WebSocket listener BEFORE navigating
    page.on('websocket', ws => {
      ws.on('framesent', frame => {
        if (typeof frame.payload === 'string') {
          sentMessages.push(frame.payload)
        }
      })
    })

    await page.goto('/')

    // Wait for connection to establish
    await page.waitForSelector('text=Connected')

    const queryInput = getQueryInput(page)
    await queryInput.fill('Show unhealthy pods')
    await queryInput.press('Enter')

    // Wait for message to be sent
    await page.waitForTimeout(1000)

    // Find the query message
    const queryMessage = sentMessages.find(m => m.includes('"type":"query"'))
    expect(queryMessage).toBeTruthy()

    const parsed = JSON.parse(queryMessage!)
    expect(parsed.type).toBe('query')
    expect(parsed.text).toBe('Show unhealthy pods')
  })

  test('query triggers thinking message', async ({ page }) => {
    const receivedMessages: string[] = []

    page.on('websocket', ws => {
      ws.on('framereceived', frame => {
        if (typeof frame.payload === 'string') {
          receivedMessages.push(frame.payload)
        }
      })
    })

    await page.goto('/')
    await page.waitForTimeout(500)

    const queryInput = getQueryInput(page)
    await queryInput.fill('Test query')
    await queryInput.press('Enter')

    // Wait for response
    await page.waitForTimeout(1000)

    // Should have thinking message
    const thinkingMessage = receivedMessages.find(m => m.includes('"type":"thinking"'))
    expect(thinkingMessage).toBeTruthy()
  })

  test('query creates impulse response', async ({ page }) => {
    const receivedMessages: string[] = []

    page.on('websocket', ws => {
      ws.on('framereceived', frame => {
        if (typeof frame.payload === 'string') {
          receivedMessages.push(frame.payload)
        }
      })
    })

    await page.goto('/')
    await page.waitForTimeout(500)

    const queryInput = getQueryInput(page)
    await queryInput.fill('Test query')
    await queryInput.press('Enter')

    // Wait for response
    await page.waitForTimeout(1500)

    // Should have impulse_create message
    const impulseMessage = receivedMessages.find(m => m.includes('"type":"impulse_create"'))
    expect(impulseMessage).toBeTruthy()

    const parsed = JSON.parse(impulseMessage!)
    expect(parsed.impulse).toBeDefined()
    expect(parsed.impulse.primitive).toBeDefined()
  })
})

test.describe('Impulse Rendering', () => {
  // Helper to get the main query input
  const getQueryInput = (page: Page) => page.locator('.fixed.bottom-8 input[placeholder*="Ask"]')

  test('impulse renders as UI component', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)

    // Submit a query to create an impulse
    const queryInput = getQueryInput(page)
    await queryInput.fill('Test rendering')
    await queryInput.press('Enter')

    // Wait for rendering
    await page.waitForTimeout(2000)

    // Should have rendered component with data attributes
    const component = page.locator('[data-component-id]')
    await expect(component.first()).toBeVisible()
  })

  test('rendered component has correct data attributes', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)

    const queryInput = getQueryInput(page)
    await queryInput.fill('Test attributes')
    await queryInput.press('Enter')

    await page.waitForTimeout(2000)

    // Find component
    const component = page.locator('[data-component-id]').first()
    await expect(component).toBeVisible()

    // Should have data-component-type
    const componentType = await component.getAttribute('data-component-type')
    expect(componentType).toBeTruthy()
  })
})

test.describe('Connection Status', () => {
  test('shows connected status indicator', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)

    // Connection status should show "Connected"
    const statusText = page.locator('text=Connected')
    await expect(statusText).toBeVisible()
  })
})

test.describe('Layout Control', () => {
  test('sends viewport dimensions on connect', async ({ page }) => {
    const sentMessages: string[] = []

    page.on('websocket', ws => {
      ws.on('framesent', frame => {
        if (typeof frame.payload === 'string') {
          sentMessages.push(frame.payload)
        }
      })
    })

    await page.goto('/')
    await page.waitForTimeout(1000)

    // Should have sent viewport message
    const viewportMessage = sentMessages.find(m => m.includes('"type":"viewport"'))
    expect(viewportMessage).toBeTruthy()

    const parsed = JSON.parse(viewportMessage!)
    expect(parsed.width).toBeGreaterThan(0)
    expect(parsed.height).toBeGreaterThan(0)
  })
})
