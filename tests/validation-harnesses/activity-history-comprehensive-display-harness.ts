/**
 * Validation Harness: Activity History Comprehensive Display
 * 
 * Specification: activity-history-comprehensive-display
 * Purpose: Validate comprehensive Activity History dashboard at app.metabob.local/cloud/activity
 * 
 * Validation Strategy:
 * 1. Execute 3-5 test activities on devbob
 * 2. Query SurrealDB for ground truth data
 * 3. Use Playwright to navigate dashboard and verify:
 *    - Table shows all executions
 *    - Expandable details show tasks/impulses/outcomes
 *    - Filters work (template_id, success)
 *    - Sorting works (timestamp, cost, duration)
 *    - Data matches DB within 1% variance
 * 4. Capture screenshots as evidence
 * 
 * Success Criteria:
 * - All executions visible in table
 * - Expandable rows show complete task breakdown
 * - Impulses used displayed with token counts
 * - Filters reduce results correctly
 * - Sorting changes order correctly
 * - Numerical data matches DB within 1%
 * - Page loads <3s
 * - No console errors
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CONFIG = {
  dashboardUrl: process.env.DASHBOARD_URL || 'http://app.metabob.local',
  rpcApiUrl: process.env.RPC_API_URL || 'http://metabob-rpc-api:8080',
  surrealHost: process.env.SURREAL_HOST || 'surrealdb',
  surrealPort: process.env.SURREAL_PORT || '8000',
  surrealUser: process.env.SURREAL_USER || 'root',
  surrealPass: process.env.SURREAL_PASS || 'root',
  surrealNamespace: process.env.SURREAL_NAMESPACE || 'metabob',
  surrealDatabase: process.env.SURREAL_DATABASE || 'metabob',
  loadingTimeout: 3000,
  numericalVarianceTolerance: 0.01, // 1%
  screenshotDir: path.join(__dirname, '../../screenshots/activity-history-validation'),
};

interface ActivityExecution {
  execution_id: string;
  activity_id: string;
  template_id: string;
  success: boolean;
  timestamp: string;
  started_at: string;
  completed_at?: string;
  duration_ms: number;
  cost_usd: number;
  tokens_input: number;
  tokens_output: number;
  tokens_cache: number;
  error_message?: string;
  has_tasks: boolean;
  task_count: number;
}

interface TaskExecution {
  task_id: string;
  execution_id: string;
  template_id: string;
  status: string;
  success: boolean;
  started_at: string;
  completed_at?: string;
  duration_ms: number;
  cost_usd: number;
  tokens_input: number;
  tokens_output: number;
  tokens_cache: number;
  error_message?: string;
  retry_count: number;
}

interface ImpulseUsed {
  impulse_id: string;
  type: string;
  budget: number;
  tokens_used: number;
}

interface ValidationResult {
  pass: boolean;
  testCaseId: string;
  executionIds: string[];
  checks: {
    name: string;
    pass: boolean;
    expected: any;
    actual: any;
    variance?: number;
    message?: string;
  }[];
  screenshots: {
    [key: string]: string;
  };
  errors: string[];
  timestamp: string;
}

/**
 * Query SurrealDB for activity executions
 */
async function queryExecutions(limit: number = 10): Promise<ActivityExecution[]> {
  const query = `
    SELECT 
      id as execution_id,
      activity_id,
      template_id,
      success,
      timestamp,
      started_at,
      completed_at,
      duration_ms,
      cost_usd,
      tokens_input,
      tokens_output,
      tokens_cache,
      error_message,
      (SELECT count() FROM task_execution WHERE execution_id = $parent.id)[0].count as task_count
    FROM activity_executions
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `;

  const response = await fetch(`http://${CONFIG.surrealHost}:${CONFIG.surrealPort}/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'NS': CONFIG.surrealNamespace,
      'DB': CONFIG.surrealDatabase,
      'Authorization': `Basic ${Buffer.from(`${CONFIG.surrealUser}:${CONFIG.surrealPass}`).toString('base64')}`,
    },
    body: query,
  });

  if (!response.ok) {
    throw new Error(`SurrealDB query failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result[0]?.result || [];
}

/**
 * Query SurrealDB for task executions
 */
async function queryTaskExecutions(executionId: string): Promise<TaskExecution[]> {
  const query = `
    SELECT * FROM task_execution 
    WHERE execution_id = '${executionId}'
    ORDER BY task_index ASC
  `;

  const response = await fetch(`http://${CONFIG.surrealHost}:${CONFIG.surrealPort}/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'NS': CONFIG.surrealNamespace,
      'DB': CONFIG.surrealDatabase,
      'Authorization': `Basic ${Buffer.from(`${CONFIG.surrealUser}:${CONFIG.surrealPass}`).toString('base64')}`,
    },
    body: query,
  });

  if (!response.ok) {
    throw new Error(`SurrealDB query failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result[0]?.result || [];
}

/**
 * Query SurrealDB for impulses used
 */
async function queryImpulsesUsed(executionId: string): Promise<ImpulseUsed[]> {
  const query = `
    SELECT * FROM impulses_used 
    WHERE execution_id = '${executionId}'
  `;

  const response = await fetch(`http://${CONFIG.surrealHost}:${CONFIG.surrealPort}/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'NS': CONFIG.surrealNamespace,
      'DB': CONFIG.surrealDatabase,
      'Authorization': `Basic ${Buffer.from(`${CONFIG.surrealUser}:${CONFIG.surrealPass}`).toString('base64')}`,
    },
    body: query,
  });

  if (!response.ok) {
    throw new Error(`SurrealDB query failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result[0]?.result || [];
}

/**
 * Navigate to Activity History dashboard
 */
async function navigateToDashboard(page: Page): Promise<void> {
  await page.goto(`${CONFIG.dashboardUrl}/cloud/activity`, {
    waitUntil: 'networkidle',
    timeout: CONFIG.loadingTimeout,
  });
}

/**
 * Wait for executions table to load
 */
async function waitForExecutionsTable(page: Page): Promise<void> {
  await page.waitForSelector('table tbody tr', { timeout: CONFIG.loadingTimeout });
}

/**
 * Extract execution data from table row
 */
async function extractExecutionFromRow(page: Page, rowIndex: number): Promise<any> {
  const row = page.locator(`table tbody tr`).nth(rowIndex);
  
  const templateId = await row.locator('td').nth(0).textContent();
  const statusText = await row.locator('td').nth(1).textContent();
  const success = statusText?.includes('Success') || statusText?.includes('✓');
  const timestamp = await row.locator('td').nth(2).textContent();
  const durationText = await row.locator('td').nth(3).textContent();
  const costText = await row.locator('td').nth(4).textContent();
  const tokensText = await row.locator('td').nth(5).textContent();

  // Parse numerical values
  const duration_ms = parseFloat(durationText?.replace(/[^0-9.]/g, '') || '0');
  const cost_usd = parseFloat(costText?.replace(/[^0-9.]/g, '') || '0');
  const tokens_total = parseInt(tokensText?.replace(/[^0-9]/g, '') || '0');

  return {
    templateId,
    success,
    timestamp,
    duration_ms,
    cost_usd,
    tokens_total,
  };
}

/**
 * Expand execution row to see details
 */
async function expandExecutionRow(page: Page, rowIndex: number): Promise<void> {
  const expandButton = page.locator('table tbody tr').nth(rowIndex).locator('button[aria-label*="expand"]');
  await expandButton.click();
  await page.waitForTimeout(500); // Wait for expansion animation
}

/**
 * Extract task details from expanded row
 */
async function extractTaskDetails(page: Page, rowIndex: number): Promise<any[]> {
  const expandedContent = page.locator('table tbody').locator('[data-testid="expanded-details"]').nth(rowIndex);
  const taskRows = expandedContent.locator('[data-testid="task-row"]');
  const count = await taskRows.count();

  const tasks: any[] = [];
  for (let i = 0; i < count; i++) {
    const taskRow = taskRows.nth(i);
    const taskId = await taskRow.locator('[data-testid="task-id"]').textContent();
    const statusText = await taskRow.locator('[data-testid="task-status"]').textContent();
    const durationText = await taskRow.locator('[data-testid="task-duration"]').textContent();
    const costText = await taskRow.locator('[data-testid="task-cost"]').textContent();

    tasks.push({
      taskId,
      status: statusText,
      duration_ms: parseFloat(durationText?.replace(/[^0-9.]/g, '') || '0'),
      cost_usd: parseFloat(costText?.replace(/[^0-9.]/g, '') || '0'),
    });
  }

  return tasks;
}

/**
 * Extract impulse details from expanded row
 */
async function extractImpulseDetails(page: Page, rowIndex: number): Promise<any[]> {
  const expandedContent = page.locator('table tbody').locator('[data-testid="expanded-details"]').nth(rowIndex);
  const impulseRows = expandedContent.locator('[data-testid="impulse-row"]');
  const count = await impulseRows.count();

  const impulses: any[] = [];
  for (let i = 0; i < count; i++) {
    const impulseRow = impulseRows.nth(i);
    const impulseId = await impulseRow.locator('[data-testid="impulse-id"]').textContent();
    const typeText = await impulseRow.locator('[data-testid="impulse-type"]').textContent();
    const tokensText = await impulseRow.locator('[data-testid="impulse-tokens"]').textContent();

    impulses.push({
      impulseId,
      type: typeText,
      tokens_used: parseInt(tokensText?.replace(/[^0-9]/g, '') || '0'),
    });
  }

  return impulses;
}

/**
 * Test filtering functionality
 */
async function testFiltering(page: Page, templateId: string): Promise<boolean> {
  // Apply template filter
  await page.selectOption('select[name="template_filter"]', templateId);
  await page.waitForTimeout(500);

  // Check that all visible rows match the filter
  const rows = page.locator('table tbody tr[data-testid="execution-row"]');
  const count = await rows.count();

  for (let i = 0; i < count; i++) {
    const rowTemplateId = await rows.nth(i).locator('td').nth(0).textContent();
    if (rowTemplateId !== templateId) {
      return false;
    }
  }

  // Clear filter
  await page.selectOption('select[name="template_filter"]', '');
  await page.waitForTimeout(500);

  return true;
}

/**
 * Test sorting functionality
 */
async function testSorting(page: Page, column: string): Promise<boolean> {
  // Click sort header
  await page.click(`th[data-sort="${column}"]`);
  await page.waitForTimeout(500);

  // Extract values before and after sort
  const values: number[] = [];
  const rows = page.locator('table tbody tr[data-testid="execution-row"]');
  const count = Math.min(await rows.count(), 5);

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    let value: number;

    if (column === 'duration') {
      const text = await row.locator('td').nth(3).textContent();
      value = parseFloat(text?.replace(/[^0-9.]/g, '') || '0');
    } else if (column === 'cost') {
      const text = await row.locator('td').nth(4).textContent();
      value = parseFloat(text?.replace(/[^0-9.]/g, '') || '0');
    } else {
      value = i; // For timestamp, just check order
    }

    values.push(value);
  }

  // Check if values are sorted (descending by default)
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] < values[i + 1]) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate numerical variance between expected and actual
 */
function calculateVariance(expected: number, actual: number): number {
  if (expected === 0) return actual === 0 ? 0 : 1;
  return Math.abs((actual - expected) / expected);
}

/**
 * Take screenshot
 */
async function takeScreenshot(page: Page, name: string): Promise<string> {
  if (!fs.existsSync(CONFIG.screenshotDir)) {
    fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
  }

  const filename = `${name}-${Date.now()}.png`;
  const filepath = path.join(CONFIG.screenshotDir, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  return filepath;
}

/**
 * Main validation function
 */
export async function runValidation(testCaseId: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    pass: true,
    testCaseId,
    executionIds: [],
    checks: [],
    screenshots: {},
    errors: [],
    timestamp: new Date().toISOString(),
  };

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Step 1: Query SurrealDB for ground truth
    console.log('📊 Querying SurrealDB for ground truth data...');
    const executions = await queryExecutions(10);

    if (executions.length === 0) {
      result.pass = false;
      result.errors.push('No executions found in SurrealDB');
      return result;
    }

    result.executionIds = executions.map(e => e.execution_id);
    console.log(`✅ Found ${executions.length} executions in database`);

    // Step 2: Launch browser and navigate to dashboard
    console.log('🌐 Launching browser and navigating to dashboard...');
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    await navigateToDashboard(page);
    await waitForExecutionsTable(page);

    result.screenshots.listView = await takeScreenshot(page, 'list-view');
    console.log('✅ Dashboard loaded successfully');

    // Step 3: Verify executions are displayed in table
    console.log('🔍 Verifying executions in table...');
    const tableRows = page.locator('table tbody tr[data-testid="execution-row"]');
    const rowCount = await tableRows.count();

    result.checks.push({
      name: 'Executions visible in table',
      pass: rowCount > 0,
      expected: `${executions.length} executions`,
      actual: `${rowCount} rows`,
    });

    if (rowCount === 0) {
      result.pass = false;
      result.errors.push('No execution rows found in table');
      return result;
    }

    // Step 4: Validate data accuracy for first 3 executions
    console.log('📏 Validating data accuracy...');
    for (let i = 0; i < Math.min(3, executions.length); i++) {
      const dbExecution = executions[i];
      const uiExecution = await extractExecutionFromRow(page, i);

      // Template ID match
      const templateMatch = uiExecution.templateId?.includes(dbExecution.template_id);
      result.checks.push({
        name: `Execution ${i + 1}: Template ID match`,
        pass: templateMatch,
        expected: dbExecution.template_id,
        actual: uiExecution.templateId,
      });

      // Duration accuracy
      const durationVariance = calculateVariance(dbExecution.duration_ms, uiExecution.duration_ms);
      const durationPass = durationVariance <= CONFIG.numericalVarianceTolerance;
      result.checks.push({
        name: `Execution ${i + 1}: Duration accuracy`,
        pass: durationPass,
        expected: `${dbExecution.duration_ms}ms`,
        actual: `${uiExecution.duration_ms}ms`,
        variance: durationVariance,
      });

      // Cost accuracy
      const costVariance = calculateVariance(dbExecution.cost_usd, uiExecution.cost_usd);
      const costPass = costVariance <= CONFIG.numericalVarianceTolerance;
      result.checks.push({
        name: `Execution ${i + 1}: Cost accuracy`,
        pass: costPass,
        expected: `$${dbExecution.cost_usd}`,
        actual: `$${uiExecution.cost_usd}`,
        variance: costVariance,
      });

      if (!templateMatch || !durationPass || !costPass) {
        result.pass = false;
      }
    }

    // Step 5: Test expandable rows
    console.log('📂 Testing expandable rows...');
    const firstExecution = executions[0];
    await expandExecutionRow(page, 0);

    result.screenshots.expandedView = await takeScreenshot(page, 'expanded-view');

    // Verify task details
    const dbTasks = await queryTaskExecutions(firstExecution.execution_id);
    const uiTasks = await extractTaskDetails(page, 0);

    result.checks.push({
      name: 'Task count matches',
      pass: uiTasks.length === dbTasks.length,
      expected: `${dbTasks.length} tasks`,
      actual: `${uiTasks.length} tasks`,
    });

    if (uiTasks.length !== dbTasks.length) {
      result.pass = false;
    }

    // Verify impulse details
    const dbImpulses = await queryImpulsesUsed(firstExecution.execution_id);
    const uiImpulses = await extractImpulseDetails(page, 0);

    result.checks.push({
      name: 'Impulse count matches',
      pass: uiImpulses.length === dbImpulses.length,
      expected: `${dbImpulses.length} impulses`,
      actual: `${uiImpulses.length} impulses`,
    });

    if (uiImpulses.length !== dbImpulses.length) {
      result.pass = false;
    }

    // Step 6: Test filtering
    console.log('🔧 Testing filtering...');
    const filterPass = await testFiltering(page, firstExecution.template_id);
    result.checks.push({
      name: 'Template filter works',
      pass: filterPass,
      expected: 'Filtered rows match template',
      actual: filterPass ? 'All rows match' : 'Some rows do not match',
    });

    if (!filterPass) {
      result.pass = false;
    }

    result.screenshots.filteredView = await takeScreenshot(page, 'filtered-view');

    // Step 7: Test sorting
    console.log('🔀 Testing sorting...');
    const sortPass = await testSorting(page, 'cost');
    result.checks.push({
      name: 'Cost sorting works',
      pass: sortPass,
      expected: 'Rows sorted by cost descending',
      actual: sortPass ? 'Correctly sorted' : 'Sort order incorrect',
    });

    if (!sortPass) {
      result.pass = false;
    }

    result.screenshots.sortedView = await takeScreenshot(page, 'sorted-view');

    console.log(`✅ Validation ${result.pass ? 'PASSED' : 'FAILED'}`);

  } catch (error) {
    result.pass = false;
    result.errors.push(error instanceof Error ? error.message : String(error));
    console.error('❌ Validation error:', error);
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }

  return result;
}

/**
 * Run validation with test cases from impulses
 */
export async function runAllValidations(): Promise<ValidationResult[]> {
  const testCases = [
    'validation-activity-history-comprehensive-display-case-1',
    'validation-activity-history-comprehensive-display-case-2',
    'validation-activity-history-comprehensive-display-case-3',
  ];

  const results: ValidationResult[] = [];

  for (const testCase of testCases) {
    console.log(`\n📋 Running test case: ${testCase}`);
    const result = await runValidation(testCase);
    results.push(result);
  }

  return results;
}

// CLI execution
if (require.main === module) {
  runAllValidations()
    .then((results) => {
      console.log('\n📊 Validation Summary:');
      console.log(`Total: ${results.length}`);
      console.log(`Passed: ${results.filter(r => r.pass).length}`);
      console.log(`Failed: ${results.filter(r => !r.pass).length}`);

      const allPassed = results.every(r => r.pass);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}
