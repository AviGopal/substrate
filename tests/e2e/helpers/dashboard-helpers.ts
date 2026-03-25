/**
 * Dashboard Helpers for E2E tests
 *
 * Provides helper functions for interacting with the dashboard via Playwright.
 */

import { Page, expect } from '@playwright/test';

/**
 * Login to dashboard as a user
 */
export async function loginAsDashboard(
  page: Page,
  email: string,
  password: string = 'test-password'
): Promise<void> {
  await page.goto('/login');

  await page.fill('[data-testid="email"]', email);
  await page.fill('[data-testid="password"]', password);
  await page.click('[data-testid="login-button"]');

  // Wait for redirect to overview
  await page.waitForURL(/.*\/(overview|templates|executions)/);

  // Verify user menu is visible (indicates successful login)
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
}

/**
 * Logout from dashboard
 */
export async function logoutFromDashboard(page: Page): Promise<void> {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');

  // Wait for redirect to login
  await page.waitForURL(/.*\/login/);
}

/**
 * Navigate to a dashboard page
 */
export async function navigateTo(
  page: Page,
  section: 'overview' | 'templates' | 'executions' | 'projects' | 'api-keys' | 'profile'
): Promise<void> {
  await page.click(`[data-testid="nav-${section}"]`);
  await page.waitForURL(new RegExp(`.*/${section}`));
}

/**
 * Get all template rows from templates page
 */
export async function getTemplateRows(page: Page): Promise<{
  name: string;
  orgId: string;
  scope: string;
  executions: number;
}[]> {
  const rows = await page.locator('[data-testid="template-row"]').all();

  const templates = [];
  for (const row of rows) {
    templates.push({
      name: await row.locator('[data-testid="template-name"]').textContent() || '',
      orgId: await row.getAttribute('data-org-id') || '',
      scope: await row.locator('[data-testid="template-scope"]').textContent() || '',
      executions: parseInt(await row.locator('[data-testid="executions"]').textContent() || '0')
    });
  }

  return templates;
}

/**
 * Get all execution rows from executions page
 */
export async function getExecutionRows(page: Page): Promise<{
  executionId: string;
  variantId: string;
  success: boolean;
  duration: string;
}[]> {
  const rows = await page.locator('[data-testid="execution-row"]').all();

  const executions = [];
  for (const row of rows) {
    executions.push({
      executionId: await row.getAttribute('data-execution-id') || '',
      variantId: await row.locator('[data-testid="variant-id"]').textContent() || '',
      success: (await row.getAttribute('data-success')) === 'true',
      duration: await row.locator('[data-testid="duration"]').textContent() || ''
    });
  }

  return executions;
}

/**
 * Wait for WebSocket message
 */
export async function waitForWebSocketMessage(
  page: Page,
  messageType: string,
  timeout: number = 10000
): Promise<void> {
  await page.waitForFunction(
    (type) => {
      const lastMessage = (window as any).__lastWsMessage;
      return lastMessage && lastMessage.type === type;
    },
    messageType,
    { timeout }
  );
}

/**
 * Get current user from dashboard
 */
export async function getCurrentUser(page: Page): Promise<{
  email: string;
  orgName: string;
}> {
  const email = await page.locator('[data-testid="user-menu"]').textContent() || '';
  const orgName = await page.locator('[data-testid="current-org"]').textContent() || '';

  return { email: email.trim(), orgName: orgName.trim() };
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector('[data-testid="user-menu"]', { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for data to load in a section
 */
export async function waitForDataLoad(
  page: Page,
  testId: string,
  timeout: number = 10000
): Promise<void> {
  // Wait for loading spinner to disappear
  const spinner = page.locator(`[data-testid="${testId}-loading"]`);
  if (await spinner.isVisible()) {
    await spinner.waitFor({ state: 'hidden', timeout });
  }

  // Wait for content to appear
  await page.waitForSelector(`[data-testid="${testId}"]`, { timeout });
}

/**
 * Trigger MiniBob execution via API and wait for dashboard update
 */
export async function triggerMiniBobExecutionAndWait(
  page: Page,
  apiUrl: string = 'http://activity.metabob.local'
): Promise<string> {
  // Get MiniBob token
  const authResponse = await fetch(`${apiUrl}/v2/auth/minibob/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instance_id: 'minibob-local-001',
      api_key: 'test-api-key-123'
    })
  });
  const { token } = await authResponse.json();

  // Create execution trace
  const traceResponse = await fetch(`${apiUrl}/v2/activities/execution-traces`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      variant_id: 'test-variant-001',
      success: true,
      duration_ms: 1500,
      cost: 0.05,
      tokens: { input: 100, output: 50, cache: 0 }
    })
  });
  const { execution_id } = await traceResponse.json();

  // Wait for WebSocket update in dashboard
  await waitForWebSocketMessage(page, 'execution_completed');

  return execution_id;
}

/**
 * Create test template via API
 */
export async function createTestTemplate(
  token: string,
  options: { name: string; scope: string; public?: boolean },
  apiUrl: string = 'http://activity.metabob.local'
): Promise<string> {
  const response = await fetch(`${apiUrl}/v2/activities/templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      variant_id: `test-${Date.now()}`,
      activity_id: `activity-${Date.now()}`,
      variant_name: options.name,
      description: 'Test template',
      category: 'tool',
      task_steps: [],
      scope: options.scope,
      public: options.public || false
    })
  });

  const data = await response.json();
  return data.variant_id;
}

/**
 * Assert no elements from another org are visible
 */
export async function assertNoOtherOrgData(
  page: Page,
  expectedOrgId: string,
  dataTestId: string
): Promise<void> {
  const rows = await page.locator(`[data-testid="${dataTestId}"]`).all();

  for (const row of rows) {
    const orgId = await row.getAttribute('data-org-id');
    // Allow expected org or global (metabob_internal for global templates)
    expect([expectedOrgId, 'metabob_internal', null]).toContain(orgId);
  }
}
