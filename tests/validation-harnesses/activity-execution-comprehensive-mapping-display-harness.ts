/**
 * Validation Harness: Activity Execution Comprehensive Mapping Display
 * 
 * This harness validates that the Activity History dashboard accurately displays
 * activity execution data by:
 * 1. Executing real activities on devbob.metabob.local
 * 2. Capturing ground truth from SurrealDB
 * 3. Validating dashboard UI against ground truth data
 * 4. Checking data accuracy, completeness, and visual indicators
 * 
 * Success Criteria:
 * - All required fields present in UI
 * - Data matches SurrealDB with <1% numerical variance
 * - Expandable sections work correctly
 * - Visual indicators match statuses
 * - No critical data truncation
 * - Loading completes within 3 seconds
 */

import { test, expect, Page, chromium } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  devbobUrl: 'http://devbob.metabob.local',
  dashboardUrl: 'http://app.metabob.local',
  surrealdbUrl: 'ws://surrealdb.metabob.local:8000/rpc',
  surrealdbNs: 'metabob',
  surrealdbDb: 'metabob',
  loadingTimeout: 3000,
  numericalVarianceTolerance: 0.01, // 1%
};

interface ActivityExecution {
  execution_id: string;
  activity_id?: string;
  template_id: string;
  success: boolean;
  timestamp: string;
  duration_ms: number;
  cost_usd: number;
  tokens_input: number;
  tokens_output: number;
  tokens_cache: number;
  error_message?: string;
  impulses_used?: Array<{
    impulse_id: string;
    type: string;
    budget: number;
  }>;
  component_changes?: any[];
}

interface TaskExecution {
  task_execution_id?: string;
  task_id: string;
  task_index: number;
  subagent: string;
  status: string;
  success: boolean;
  duration_ms: number;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  error_message?: string;
}

interface ValidationResult {
  pass: boolean;
  execution_id: string;
  checks: {
    name: string;
    pass: boolean;
    expected: any;
    actual: any;
    variance?: number;
  }[];
  screenshots: {
    listView: string;
    expandedView: string;
  };
  errors: string[];
}

/**
 * Connect to SurrealDB and authenticate
 * Note: Using fetch API for SurrealDB queries instead of surrealdb.js library
 */
async function connectToSurrealDB(): Promise<any> {
  // Return a simple query interface using fetch
  return {
    query: async (sql: string, params?: Record<string, any>) => {
      const response = await fetch(CONFIG.surrealdbUrl.replace('ws://', 'http://').replace('/rpc', '/sql'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'NS': CONFIG.surrealdbNs,
          'DB': CONFIG.surrealdbDb,
        },
        body: JSON.stringify({ query: sql, vars: params }),
      });
      return await response.json();
    },
    close: async () => {
      // No-op for fetch-based client
    },
  };
}

/**
 * Execute an activity on devbob using kubectl
 */
async function executeActivityOnDevbob(templateId: string, variables: Record<string, any> = {}): Promise<string> {
  console.log(`Executing activity: ${templateId} on devbob`);
  
  // Build variable args
  const varArgs = Object.entries(variables)
    .map(([key, value]) => `--var ${key}=${JSON.stringify(value)}`)
    .join(' ');
  
  // Execute activity via kubectl exec
  const command = `kubectl exec -n metabob $(kubectl get pods -n metabob -l app=devbob -o jsonpath='{.items[0].metadata.name}') -- /app/bin/opencode activity execute ${templateId} ${varArgs} --json`;
  
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 120000 });
    if (stderr) {
      console.warn(`Activity execution stderr: ${stderr}`);
    }
    
    // Parse JSON output to extract execution_id
    const output = JSON.parse(stdout);
    const executionId = output.execution_id || output.activity_id;
    
    if (!executionId) {
      throw new Error('Failed to extract execution_id from activity output');
    }
    
    console.log(`Activity executed successfully: ${executionId}`);
    return executionId;
  } catch (error) {
    console.error(`Failed to execute activity on devbob: ${error}`);
    throw error;
  }
}

/**
 * Wait for activity execution to complete in SurrealDB
 */
async function waitForExecutionCompletion(db: any, executionId: string, timeout: number = 60000): Promise<ActivityExecution> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const query = `SELECT * FROM activity_executions WHERE execution_id = $execution_id LIMIT 1`;
    const result = await db.query(query, { execution_id: executionId });
    
    if (result && result.length > 0 && result[0].length > 0) {
      const execution = result[0][0] as ActivityExecution;
      
      // Check if execution is complete (has duration and either success or error)
      if (execution.duration_ms > 0 || execution.error_message) {
        console.log(`Execution ${executionId} completed with success=${execution.success}`);
        return execution;
      }
    }
    
    // Wait 1 second before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error(`Execution ${executionId} did not complete within ${timeout}ms`);
}

/**
 * Fetch task executions for an activity from SurrealDB
 */
async function fetchTaskExecutions(db: any, executionId: string): Promise<TaskExecution[]> {
  const query = `SELECT * FROM task_execution WHERE execution_id = $execution_id ORDER BY task_index ASC`;
  const result = await db.query(query, { execution_id: executionId });
  
  if (!result || result.length === 0) {
    return [];
  }
  
  return result[0] as TaskExecution[];
}

/**
 * Navigate to Activity History page and wait for data to load
 */
async function navigateToActivityHistory(page: Page): Promise<void> {
  console.log('Navigating to Activity History page');
  await page.goto(`${CONFIG.dashboardUrl}/activity`);
  
  // Wait for table to load (look for table element)
  await page.waitForSelector('table', { timeout: CONFIG.loadingTimeout });
  
  // Wait for at least one execution row
  await page.waitForSelector('table tbody tr', { timeout: CONFIG.loadingTimeout });
  
  console.log('Activity History page loaded');
}

/**
 * Find execution row in the table by execution ID
 */
async function findExecutionRow(page: Page, executionId: string): Promise<any> {
  // Look for row containing execution ID
  const rows = await page.$$('table tbody tr');
  
  for (const row of rows) {
    const text = await row.textContent();
    if (text && text.includes(executionId)) {
      return row;
    }
  }
  
  throw new Error(`Execution row not found for ID: ${executionId}`);
}

/**
 * Extract execution data from UI row
 */
async function extractExecutionDataFromUI(page: Page, executionId: string): Promise<Record<string, any>> {
  const row = await findExecutionRow(page, executionId);
  
  // Extract data from table cells
  const cells = await row.$$('td');
  
  const data: Record<string, any> = {
    execution_id: executionId,
  };
  
  // Cell order: [Expand button, Status icon, Template, Execution ID, Timestamp, Duration, Cost, Tokens, Tasks]
  if (cells.length >= 9) {
    // Status (check for success/error icon)
    const statusCell = cells[1];
    const hasSuccessIcon = await statusCell.$('svg[data-testid="CheckCircleIcon"]');
    data.success = hasSuccessIcon !== null;
    
    // Template
    data.template_id = await cells[2].textContent();
    
    // Duration (parse from text)
    const durationText = await cells[5].textContent();
    data.duration_display = durationText;
    
    // Cost (parse from chip text)
    const costText = await cells[6].textContent();
    data.cost_display = costText;
    
    // Tokens
    const tokensText = await cells[7].textContent();
    data.tokens_display = tokensText;
    
    // Tasks
    const tasksText = await cells[8].textContent();
    data.tasks_display = tasksText;
  }
  
  return data;
}

/**
 * Expand execution row to show detailed breakdown
 */
async function expandExecutionRow(page: Page, executionId: string): Promise<void> {
  const row = await findExecutionRow(page, executionId);
  
  // Click expand button (first cell)
  const expandButton = await row.$('button');
  if (!expandButton) {
    throw new Error('Expand button not found');
  }
  
  await expandButton.click();
  
  // Wait for collapse section to appear
  await page.waitForSelector('.MuiCollapse-entered', { timeout: 2000 });
  
  console.log(`Expanded execution row: ${executionId}`);
}

/**
 * Extract detailed execution data from expanded view
 */
async function extractDetailedDataFromUI(page: Page): Promise<Record<string, any>> {
  const data: Record<string, any> = {
    tasks: [],
    impulses: [],
    error_message: null,
  };
  
  // Extract task data from task table
  const taskRows = await page.$$('table[size="small"] tbody tr');
  for (const taskRow of taskRows) {
    const cells = await taskRow.$$('td');
    if (cells.length >= 6) {
      const task = {
        task_id: await cells[0].textContent(),
        status: await cells[1].textContent(),
        duration: await cells[2].textContent(),
        tokens: await cells[3].textContent(),
        cost: await cells[4].textContent(),
      };
      data.tasks.push(task);
    }
  }
  
  // Extract impulse data from chips
  const impulseChips = await page.$$('.MuiChip-root[label*="impulse"]');
  for (const chip of impulseChips) {
    const label = await chip.textContent();
    data.impulses.push(label);
  }
  
  // Check for error message
  const errorPanel = await page.$('pre');
  if (errorPanel) {
    data.error_message = await errorPanel.textContent();
  }
  
  return data;
}

/**
 * Compare numerical values with tolerance
 */
function compareNumerical(expected: number, actual: number, tolerance: number = CONFIG.numericalVarianceTolerance): { pass: boolean; variance: number } {
  if (expected === 0 && actual === 0) {
    return { pass: true, variance: 0 };
  }
  
  const variance = Math.abs((actual - expected) / expected);
  const pass = variance <= tolerance;
  
  return { pass, variance };
}

/**
 * Parse duration string (e.g., "45.0s", "1.5m") to milliseconds
 */
function parseDuration(durationStr: string): number {
  const match = durationStr.match(/^([\d.]+)(ms|s|m)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${durationStr}`);
  }
  
  const value = parseFloat(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * Parse cost string (e.g., "$0.0234") to number
 */
function parseCost(costStr: string): number {
  const match = costStr.match(/\$([\d.]+)/);
  if (!match) {
    throw new Error(`Invalid cost format: ${costStr}`);
  }
  return parseFloat(match[1]);
}

/**
 * Parse tokens string (e.g., "12,500") to number
 */
function parseTokens(tokensStr: string): number {
  return parseInt(tokensStr.replace(/,/g, ''), 10);
}

/**
 * Run validation for a single execution
 */
export async function runValidation(input: {
  templateId: string;
  variables?: Record<string, any>;
}): Promise<ValidationResult> {
  const result: ValidationResult = {
    pass: false,
    execution_id: '',
    checks: [],
    screenshots: {
      listView: '',
      expandedView: '',
    },
    errors: [],
  };
  
  let db: any | null = null;
  
  try {
    // Step 1: Connect to SurrealDB
    console.log('Connecting to SurrealDB...');
    db = await connectToSurrealDB();
    
    // Step 2: Execute activity on devbob
    console.log(`Executing activity: ${input.templateId}`);
    const executionId = await executeActivityOnDevbob(input.templateId, input.variables);
    result.execution_id = executionId;
    
    // Step 3: Wait for execution completion
    console.log('Waiting for execution to complete...');
    const groundTruth = await waitForExecutionCompletion(db, executionId);
    const groundTruthTasks = await fetchTaskExecutions(db, executionId);
    
    console.log('Ground truth data captured:');
    console.log(`  - Execution: ${groundTruth.execution_id}`);
    console.log(`  - Success: ${groundTruth.success}`);
    console.log(`  - Duration: ${groundTruth.duration_ms}ms`);
    console.log(`  - Cost: $${groundTruth.cost_usd}`);
    console.log(`  - Tokens: ${groundTruth.tokens_input + groundTruth.tokens_output + groundTruth.tokens_cache}`);
    console.log(`  - Tasks: ${groundTruthTasks.length}`);
    console.log(`  - Impulses: ${groundTruth.impulses_used?.length || 0}`);
    
    // Step 4: Open dashboard and validate UI
    const browser = await test.step('Launch browser', async () => {
      return await chromium.launch({ headless: false });
    });
    
    const page = await browser.newPage();
    
    await test.step('Navigate to Activity History', async () => {
      await navigateToActivityHistory(page);
    });
    
    // Capture list view screenshot
    result.screenshots.listView = `screenshots/activity-history-list-${executionId}.png`;
    await page.screenshot({ path: result.screenshots.listView, fullPage: true });
    
    // Extract data from list view
    const listViewData = await extractExecutionDataFromUI(page, executionId);
    
    // Check 1: Execution ID visible
    result.checks.push({
      name: 'Execution ID visible',
      pass: listViewData.execution_id === executionId,
      expected: executionId,
      actual: listViewData.execution_id,
    });
    
    // Check 2: Template ID correct
    result.checks.push({
      name: 'Template ID correct',
      pass: listViewData.template_id?.trim() === groundTruth.template_id,
      expected: groundTruth.template_id,
      actual: listViewData.template_id,
    });
    
    // Check 3: Success status correct
    result.checks.push({
      name: 'Success status indicator',
      pass: listViewData.success === groundTruth.success,
      expected: groundTruth.success,
      actual: listViewData.success,
    });
    
    // Check 4: Duration display
    try {
      const displayedDuration = parseDuration(listViewData.duration_display);
      const durationCheck = compareNumerical(groundTruth.duration_ms, displayedDuration);
      result.checks.push({
        name: 'Duration accuracy',
        pass: durationCheck.pass,
        expected: groundTruth.duration_ms,
        actual: displayedDuration,
        variance: durationCheck.variance,
      });
    } catch (error) {
      result.checks.push({
        name: 'Duration accuracy',
        pass: false,
        expected: groundTruth.duration_ms,
        actual: listViewData.duration_display,
      });
      result.errors.push(`Duration parse error: ${error}`);
    }
    
    // Check 5: Cost display
    try {
      const displayedCost = parseCost(listViewData.cost_display);
      const costCheck = compareNumerical(groundTruth.cost_usd, displayedCost);
      result.checks.push({
        name: 'Cost accuracy',
        pass: costCheck.pass,
        expected: groundTruth.cost_usd,
        actual: displayedCost,
        variance: costCheck.variance,
      });
    } catch (error) {
      result.checks.push({
        name: 'Cost accuracy',
        pass: false,
        expected: groundTruth.cost_usd,
        actual: listViewData.cost_display,
      });
      result.errors.push(`Cost parse error: ${error}`);
    }
    
    // Check 6: Tokens display
    try {
      const displayedTokens = parseTokens(listViewData.tokens_display);
      const expectedTokens = groundTruth.tokens_input + groundTruth.tokens_output + groundTruth.tokens_cache;
      const tokensCheck = compareNumerical(expectedTokens, displayedTokens);
      result.checks.push({
        name: 'Tokens accuracy',
        pass: tokensCheck.pass,
        expected: expectedTokens,
        actual: displayedTokens,
        variance: tokensCheck.variance,
      });
    } catch (error) {
      result.checks.push({
        name: 'Tokens accuracy',
        pass: false,
        expected: groundTruth.tokens_input + groundTruth.tokens_output + groundTruth.tokens_cache,
        actual: listViewData.tokens_display,
      });
      result.errors.push(`Tokens parse error: ${error}`);
    }
    
    // Check 7: Task count display
    const expectedTaskCount = groundTruthTasks.length;
    const displayedTaskCount = parseInt(listViewData.tasks_display?.match(/\d+/)?.[0] || '0', 10);
    result.checks.push({
      name: 'Task count display',
      pass: displayedTaskCount === expectedTaskCount,
      expected: expectedTaskCount,
      actual: displayedTaskCount,
    });
    
    // Step 5: Expand row and validate detailed view
    await test.step('Expand execution row', async () => {
      await expandExecutionRow(page, executionId);
    });
    
    // Capture expanded view screenshot
    result.screenshots.expandedView = `screenshots/activity-history-expanded-${executionId}.png`;
    await page.screenshot({ path: result.screenshots.expandedView, fullPage: true });
    
    // Extract detailed data
    const detailedData = await extractDetailedDataFromUI(page);
    
    // Check 8: Task breakdown present
    result.checks.push({
      name: 'Task breakdown present',
      pass: detailedData.tasks.length === expectedTaskCount,
      expected: expectedTaskCount,
      actual: detailedData.tasks.length,
    });
    
    // Check 9: Impulse usage display
    const expectedImpulseCount = groundTruth.impulses_used?.length || 0;
    result.checks.push({
      name: 'Impulse usage display',
      pass: detailedData.impulses.length === expectedImpulseCount,
      expected: expectedImpulseCount,
      actual: detailedData.impulses.length,
    });
    
    // Check 10: Error message display (if applicable)
    if (groundTruth.error_message) {
      result.checks.push({
        name: 'Error message display',
        pass: detailedData.error_message !== null,
        expected: 'Error message present',
        actual: detailedData.error_message ? 'Present' : 'Missing',
      });
    }
    
    await browser.close();
    
    // Determine overall pass/fail
    result.pass = result.checks.every(check => check.pass);
    
    console.log(`\nValidation ${result.pass ? 'PASSED' : 'FAILED'}`);
    console.log(`Checks passed: ${result.checks.filter(c => c.pass).length} / ${result.checks.length}`);
    
    if (!result.pass) {
      console.log('\nFailed checks:');
      result.checks.filter(c => !c.pass).forEach(check => {
        console.log(`  - ${check.name}: expected ${JSON.stringify(check.expected)}, got ${JSON.stringify(check.actual)}`);
      });
    }
    
  } catch (error) {
    result.errors.push(`Validation error: ${error}`);
    console.error('Validation failed with error:', error);
  } finally {
    if (db) {
      await db.close();
    }
  }
  
  return result;
}

/**
 * Playwright test suite
 */
test.describe('Activity Execution Comprehensive Mapping Display Validation', () => {
  test('Validate activity execution display accuracy', async () => {
    const result = await runValidation({
      templateId: 'add-rest-endpoint',
      variables: {
        method: 'POST',
        path: '/api/test',
        description: 'Test endpoint for validation',
      },
    });
    
    expect(result.pass).toBe(true);
    expect(result.errors).toHaveLength(0);
    
    // Verify all critical checks passed
    const criticalChecks = [
      'Execution ID visible',
      'Template ID correct',
      'Success status indicator',
      'Task breakdown present',
    ];
    
    for (const checkName of criticalChecks) {
      const check = result.checks.find(c => c.name === checkName);
      expect(check?.pass).toBe(true);
    }
  });
});
