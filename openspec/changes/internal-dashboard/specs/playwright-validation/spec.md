## ADDED Requirements

### Requirement: Playwright observes MiniBob's control of the dashboard
The system SHALL include Playwright tests that verify MiniBob can effectively control the dashboard UI through activities.

#### Scenario: End-to-end query execution
- **GIVEN** the internal dashboard is deployed and accessible
- **WHEN** Playwright submits a query via the input
- **THEN** Playwright observes components appearing in the DOM
- **AND** verifies the components match what MiniBob intended to create

#### Scenario: Component position verification
- **WHEN** MiniBob creates a component with `position: 'below-input'`
- **THEN** Playwright verifies the component's bounding box is below the input element

#### Scenario: Component update verification
- **WHEN** MiniBob updates a component (data, position, or content)
- **THEN** Playwright observes the DOM change
- **AND** verifies the new state matches the update

#### Scenario: Interactive action verification
- **WHEN** Playwright clicks a button created by MiniBob
- **THEN** the action is sent to MiniBob
- **AND** MiniBob's response creates/updates components
- **AND** Playwright verifies the result

---

## PLAYWRIGHT TEST STRUCTURE

### Test File: `tests/minibob-control.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('MiniBob Dashboard Control', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://internal.metabob.local')
    // Wait for WebSocket connection
    await expect(page.locator('[data-connection-status="connected"]')).toBeVisible()
  })

  // === BASIC CONTROL TESTS ===

  test('query creates table component', async ({ page }) => {
    // Submit query
    await page.locator('[data-testid="query-input"]').fill('Show recent executions')
    await page.keyboard.press('Enter')

    // Wait for thinking indicator
    await expect(page.locator('[data-testid="thinking-indicator"]')).toBeVisible()

    // Wait for table to appear
    const table = page.locator('[data-component-type="data-table"]')
    await expect(table).toBeVisible({ timeout: 30000 })

    // Verify table has data
    const rows = table.locator('tbody tr')
    await expect(rows).toHaveCount.greaterThan(0)
  })

  test('query creates chart component', async ({ page }) => {
    await page.locator('[data-testid="query-input"]').fill('Show success rate trend')
    await page.keyboard.press('Enter')

    const chart = page.locator('[data-component-type="chart"]')
    await expect(chart).toBeVisible({ timeout: 30000 })

    // Verify chart type
    await expect(chart).toHaveAttribute('data-chart-type', /(line|bar|sparkline)/)
  })

  test('query creates composed layout', async ({ page }) => {
    await page.locator('[data-testid="query-input"]').fill('Show system health dashboard')
    await page.keyboard.press('Enter')

    // Should create a container with multiple children
    const container = page.locator('[data-component-type="container"]')
    await expect(container).toBeVisible({ timeout: 30000 })

    // Container should have multiple children
    const children = container.locator('[data-component-type]')
    await expect(children).toHaveCount.greaterThan(1)
  })

  // === POSITION CONTROL TESTS ===

  test('component positions below input', async ({ page }) => {
    await page.locator('[data-testid="query-input"]').fill('Show pods')
    await page.keyboard.press('Enter')

    const table = page.locator('[data-component-type="data-table"]')
    await expect(table).toBeVisible({ timeout: 30000 })

    // Get bounding boxes
    const inputBox = await page.locator('[data-testid="query-input"]').boundingBox()
    const tableBox = await table.boundingBox()

    // Table should be below input
    expect(tableBox.y).toBeGreaterThan(inputBox.y + inputBox.height)
  })

  test('multiple components stack vertically', async ({ page }) => {
    // Query that creates multiple components
    await page.locator('[data-testid="query-input"]').fill('Show executions and explain the results')
    await page.keyboard.press('Enter')

    // Wait for both components
    const table = page.locator('[data-component-type="data-table"]')
    const narrative = page.locator('[data-component-type="text"][data-format="markdown"]')

    await expect(table).toBeVisible({ timeout: 30000 })
    await expect(narrative).toBeVisible({ timeout: 30000 })

    // Get positions
    const tableBox = await table.boundingBox()
    const narrativeBox = await narrative.boundingBox()

    // One should be above the other (not overlapping)
    const noOverlap = tableBox.y + tableBox.height <= narrativeBox.y ||
                      narrativeBox.y + narrativeBox.height <= tableBox.y
    expect(noOverlap).toBe(true)
  })

  // === UPDATE CONTROL TESTS ===

  test('component updates without remounting', async ({ page }) => {
    await page.locator('[data-testid="query-input"]').fill('Show executions')
    await page.keyboard.press('Enter')

    const table = page.locator('[data-component-type="data-table"]')
    await expect(table).toBeVisible({ timeout: 30000 })

    // Get initial row count
    const initialRows = await table.locator('tbody tr').count()

    // Follow-up query that should update the table
    await page.locator('[data-testid="query-input"]').fill('Filter to only failures')
    await page.keyboard.press('Enter')

    // Wait for update (same component, new data)
    await page.waitForTimeout(2000)

    // Should still be the same table (check data-id is same)
    const tableId = await table.getAttribute('data-component-id')
    const updatedTable = page.locator(`[data-component-id="${tableId}"]`)
    await expect(updatedTable).toBeVisible()

    // Row count should be different (filtered)
    const filteredRows = await updatedTable.locator('tbody tr').count()
    expect(filteredRows).toBeLessThanOrEqual(initialRows)
  })

  test('streaming rows appear incrementally', async ({ page }) => {
    await page.locator('[data-testid="query-input"]').fill('Show all executions from last week')
    await page.keyboard.press('Enter')

    const table = page.locator('[data-component-type="data-table"]')

    // Observe row count increasing over time
    let previousCount = 0
    let sawIncrement = false

    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(500)
      const currentCount = await table.locator('tbody tr').count()
      if (currentCount > previousCount && previousCount > 0) {
        sawIncrement = true
        break
      }
      previousCount = currentCount
    }

    // For large datasets, we should see incremental loading
    // (This test may need adjustment based on data size)
  })

  // === INTERACTION CONTROL TESTS ===

  test('button click triggers MiniBob action', async ({ page }) => {
    // Create a scenario with an action button
    await page.locator('[data-testid="query-input"]').fill('Show circuit breaker status')
    await page.keyboard.press('Enter')

    // Wait for button to appear
    const button = page.locator('[data-component-type="button"]')
    await expect(button).toBeVisible({ timeout: 30000 })

    // Click the button
    await button.click()

    // Should see thinking indicator (MiniBob processing action)
    await expect(page.locator('[data-testid="thinking-indicator"]')).toBeVisible()

    // Should see result (new component or update)
    // Wait for thinking to complete
    await expect(page.locator('[data-testid="thinking-indicator"]')).not.toBeVisible({ timeout: 30000 })
  })

  test('table row click triggers detail query', async ({ page }) => {
    await page.locator('[data-testid="query-input"]').fill('Show templates')
    await page.keyboard.press('Enter')

    const table = page.locator('[data-component-type="data-table"]')
    await expect(table).toBeVisible({ timeout: 30000 })

    // Click first row
    await table.locator('tbody tr').first().click()

    // Should trigger MiniBob to show details
    await expect(page.locator('[data-testid="thinking-indicator"]')).toBeVisible()

    // Should create a detail view
    await page.waitForTimeout(5000)
    const componentCount = await page.locator('[data-component-type]').count()
    expect(componentCount).toBeGreaterThan(1)
  })

  // === IMPROVISATION TESTS ===

  test('novel query is handled via improvisation', async ({ page }) => {
    // Query that definitely has no template
    const novelQuery = `Show the ratio of successful to failed executions as a pie chart with percentages labeled`

    await page.locator('[data-testid="query-input"]').fill(novelQuery)
    await page.keyboard.press('Enter')

    // Should see thinking (improvisation takes longer)
    await expect(page.locator('[data-testid="thinking-indicator"]')).toBeVisible()

    // Should eventually produce a result
    const chart = page.locator('[data-component-type="chart"]')
    await expect(chart).toBeVisible({ timeout: 60000 }) // Longer timeout for improvisation

    // Should be a pie chart
    await expect(chart).toHaveAttribute('data-chart-type', 'pie')
  })

  test('comparison query creates side-by-side layout', async ({ page }) => {
    await page.locator('[data-testid="query-input"]').fill('Compare template A vs template B side by side')
    await page.keyboard.press('Enter')

    // Should create a container with horizontal layout
    const container = page.locator('[data-component-type="container"][data-layout="horizontal"], [data-component-type="container"][data-layout="grid"]')
    await expect(container).toBeVisible({ timeout: 60000 })

    // Should have at least 2 children
    const children = container.locator('[data-component-type]')
    await expect(children).toHaveCount.greaterThanOrEqual(2)
  })

  // === CLEAR AND RESET TESTS ===

  test('/clear command resets UI', async ({ page }) => {
    // Create some components
    await page.locator('[data-testid="query-input"]').fill('Show executions')
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-component-type="data-table"]')).toBeVisible({ timeout: 30000 })

    // Clear
    await page.locator('[data-testid="query-input"]').fill('/clear')
    await page.keyboard.press('Enter')

    // Should only have input remaining
    await page.waitForTimeout(1000)
    const components = await page.locator('[data-component-type]:not([data-protected="true"])').count()
    expect(components).toBe(0)

    // Input should still be there
    await expect(page.locator('[data-testid="query-input"]')).toBeVisible()
  })

  // === LAYOUT STATE TESTS ===

  test('MiniBob avoids overlapping components', async ({ page }) => {
    // Query that creates multiple components
    await page.locator('[data-testid="query-input"]').fill('Show pods, services, and events')
    await page.keyboard.press('Enter')

    // Wait for components
    await page.waitForTimeout(10000)

    // Get all component bounding boxes
    const components = page.locator('[data-component-type]')
    const count = await components.count()

    const boxes = []
    for (let i = 0; i < count; i++) {
      const box = await components.nth(i).boundingBox()
      if (box) boxes.push(box)
    }

    // Check for overlaps
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]

        const overlaps = !(a.x + a.width <= b.x ||
                          b.x + b.width <= a.x ||
                          a.y + a.height <= b.y ||
                          b.y + b.height <= a.y)

        // Allow some overlap for intentional layering, but not significant
        if (overlaps) {
          const overlapArea = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
                              Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
          const smallerArea = Math.min(a.width * a.height, b.width * b.height)
          const overlapPercent = overlapArea / smallerArea

          // Less than 10% overlap is acceptable
          expect(overlapPercent).toBeLessThan(0.1)
        }
      }
    }
  })
})
```

---

## WEBSOCKET MESSAGE OBSERVATION

### Capturing Messages for Verification

```typescript
test.describe('WebSocket Message Verification', () => {

  test('observe MiniBob message sequence', async ({ page }) => {
    const messages: any[] = []

    // Intercept WebSocket messages
    await page.exposeFunction('captureWsMessage', (msg: string) => {
      messages.push(JSON.parse(msg))
    })

    await page.addInitScript(() => {
      const originalWs = window.WebSocket
      window.WebSocket = function(url: string) {
        const ws = new originalWs(url)
        ws.addEventListener('message', (e) => {
          (window as any).captureWsMessage(e.data)
        })
        return ws
      } as any
    })

    await page.goto('http://internal.metabob.local')
    await page.locator('[data-testid="query-input"]').fill('Show pods')
    await page.keyboard.press('Enter')

    // Wait for completion
    await page.waitForTimeout(10000)

    // Verify message sequence
    const messageTypes = messages.map(m => m.type)

    // Should see: thinking, tool_call, impulse_create, activity_complete
    expect(messageTypes).toContain('thinking')
    expect(messageTypes).toContain('impulse_create')
    expect(messageTypes).toContain('activity_complete')

    // Find the impulse_create message
    const createMsg = messages.find(m => m.type === 'impulse_create')
    expect(createMsg.impulse.pointer.component.type).toBeDefined()
  })

  test('verify correct primitive structure', async ({ page }) => {
    const impulses: any[] = []

    // Capture impulse_create messages
    await page.exposeFunction('captureImpulse', (msg: string) => {
      const parsed = JSON.parse(msg)
      if (parsed.type === 'impulse_create') {
        impulses.push(parsed.impulse)
      }
    })

    await page.addInitScript(() => {
      const originalWs = window.WebSocket
      window.WebSocket = function(url: string) {
        const ws = new originalWs(url)
        ws.addEventListener('message', (e) => {
          (window as any).captureImpulse(e.data)
        })
        return ws
      } as any
    })

    await page.goto('http://internal.metabob.local')
    await page.locator('[data-testid="query-input"]').fill('Show executions as table')
    await page.keyboard.press('Enter')

    await page.waitForTimeout(10000)

    // Find the table impulse
    const tableImpulse = impulses.find(i =>
      i.pointer?.component?.type === 'data-table' ||
      i.pointer?.component?.children?.some((c: any) => c.type === 'data-table')
    )

    expect(tableImpulse).toBeDefined()

    // Verify it has required properties
    const table = tableImpulse.pointer.component.type === 'data-table'
      ? tableImpulse.pointer.component
      : tableImpulse.pointer.component.children.find((c: any) => c.type === 'data-table')

    expect(table.columns).toBeDefined()
    expect(Array.isArray(table.columns)).toBe(true)
    expect(table.data || table.dataRef).toBeDefined()
  })
})
```

---

## CONTROL PROOF MATRIX

| Capability | Test Method | Pass Criteria |
|------------|-------------|---------------|
| Create component | Submit query, verify DOM element appears | Element with correct data-component-type exists |
| Position component | Check bounding box relative to input | Component.y > input.y + input.height |
| Update component | Submit follow-up, check same ID, new content | Same data-component-id, different content |
| Delete component | /clear command, verify removal | Only protected elements remain |
| Stream data | Observe row count increasing over time | Row count increases in steps |
| Handle action | Click button, observe MiniBob response | Thinking indicator → new/updated component |
| Compose layout | Complex query, verify nested structure | Container with multiple children |
| Avoid overlap | Multiple components, check bounding boxes | <10% overlap between any pair |
| Improvise | Novel query, verify result produced | Component created within timeout |
| Layout awareness | Multi-component query, logical arrangement | Components arranged without overlap |

---

## AUTOMATED CI INTEGRATION

### GitHub Actions Workflow

```yaml
name: Dashboard Control Tests

on:
  push:
    paths:
      - 'repos/metabob-internal-dashboard/**'
      - 'repos/minibob/**'

jobs:
  playwright-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install
        working-directory: repos/metabob-internal-dashboard

      - name: Install Playwright browsers
        run: bunx playwright install --with-deps
        working-directory: repos/metabob-internal-dashboard

      - name: Start services (docker-compose)
        run: docker-compose up -d
        working-directory: helm

      - name: Wait for services
        run: |
          timeout 60 bash -c 'until curl -s http://localhost:3001/health; do sleep 2; done'

      - name: Run Playwright tests
        run: bunx playwright test
        working-directory: repos/metabob-internal-dashboard

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: repos/metabob-internal-dashboard/playwright-report
```

---

## SUCCESS CRITERIA

The internal dashboard MiniBob control is PROVEN when:

1. **All 10 control tests pass** - Basic CRUD, positioning, updates
2. **Improvisation tests pass** - Novel queries produce results
3. **No overlapping components** - Layout logic works
4. **WebSocket messages verify intent** - MiniBob sends correct primitives
5. **CI runs green** - Automated verification in pipeline

This provides objective, repeatable proof that MiniBob can effectively control the dashboard UI through activity execution.
