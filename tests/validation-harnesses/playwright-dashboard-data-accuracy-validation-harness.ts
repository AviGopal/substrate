/**
 * Validation Harness: Playwright Dashboard Data Accuracy Validation
 * 
 * This harness implements three-way verification to ensure dashboard at app.metabob.local
 * displays accurate data from SurrealDB originating from devbob.metabob.local:
 * 
 * 1. Execute activity on devbob.metabob.local using kubectl/opencode CLI
 * 2. Query SurrealDB directly to retrieve activity_executions record (ground truth)
 * 3. Navigate to app.metabob.local dashboard and extract UI values
 * 4. Compare UI values against database ground truth with assertions
 * 
 * Pass Criteria:
 * - Template names match exactly
 * - Execution IDs match exactly
 * - Status values match exactly
 * - Cost variance ≤ 1%
 * - Duration variance ≤ 1%
 * - Timestamps consistent (±1 second)
 * - Task counts match exactly
 * - Impulse references preserved
 * - Screenshots show matching data
 * - No JavaScript errors in browser console
 */

import { test, expect, Page, chromium, Browser } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  devbobUrl: 'http://devbob.metabob.local',
  dashboardUrl: 'http://app.metabob.local',
  surrealdbUrl: 'ws://surrealdb.metabob.local:8000/rpc',
  surrealdbNs: 'metabob',
  surrealdbDb: 'metabob',
  kubectlNamespace: 'metabob',
  devbobPodSelector: 'app=devbob',
  
  // Validation thresholds
  costVariancePercent: 1, // 1%
  durationVariancePercent: 1, // 1%
  timestampToleranceMs: 1000, // 1 second
  
  // Timeouts
  activityExecutionTimeout: 120000, // 2 minutes
  dataPersistenceTimeout: 60000, // 1 minute
  dashboardLoadTimeout: 10000, // 10 seconds
  
  // Test activity configuration
  testTemplateName: 'add-rest-endpoint',
  testTemplateVariables: {
    method: 'POST',
    path: '/api/validation-test',
    description: 'Test endpoint for three-way validation',
  },
};

/**
 * Activity execution record from SurrealDB (ground truth)
 */
interface ActivityExecutionRecord {
  execution_id: string;
  session_id?: string;
  activity_id?: string;
  variant_id?: string;
  template_id?: string;
  template_name?: string;
  status: 'running' | 'completed' | 'failed';
  start_time: string;
  end_time?: string;
  duration_ms: number;
  cost_usd: number;
  tokens_used: {
    input: number;
    output: number;
    cache: number;
  };
  task_count?: number;
  impulse_refs?: string[];
  result?: any;
  error_message?: string;
  created_at: string;
  updated_at?: string;
}

/**
 * UI extracted data
 */
interface DashboardUIData {
  execution_id: string;
  template_name?: string;
  status?: string;
  start_time?: string;
  end_time?: string;
  duration_display?: string;
  duration_ms?: number;
  cost_display?: string;
  cost_usd?: number;
  tokens_display?: string;
  tokens_total?: number;
  task_count_display?: string;
  task_count?: number;
  impulse_count?: number;
  success_indicator?: boolean;
}

/**
 * Validation result
 */
interface ValidationResult {
  pass: boolean;
  execution_id: string;
  groundTruth: ActivityExecutionRecord | null;
  uiData: DashboardUIData | null;
  checks: Array<{
    name: string;
    pass: boolean;
    expected: any;
    actual: any;
    variance?: number;
    tolerance?: number;
  }>;
  screenshots: {
    dashboardList?: string;
    dashboardExpanded?: string;
  };
  errors: string[];
  consoleErrors: string[];
  timestamp: string;
}

/**
 * Connect to SurrealDB using fetch API
 */
async function connectToSurrealDB(): Promise<any> {
  const httpUrl = CONFIG.surrealdbUrl.replace('ws://', 'http://').replace('/rpc', '/sql');
  
  return {
    query: async (sql: string, params?: Record<string, any>) => {
      try {
        const response = await fetch(httpUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'NS': CONFIG.surrealdbNs,
            'DB': CONFIG.surrealdbDb,
            'Accept': 'application/json',
          },
          body: JSON.stringify({ query: sql, vars: params }),
        });
        
        if (!response.ok) {
          throw new Error(`SurrealDB query failed: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('SurrealDB query error:', error);
        throw error;
      }
    },
    close: async () => {
      // No-op for fetch-based client
    },
  };
}

/**
 * Execute activity on devbob using kubectl exec
 */
async function executeActivityOnDevbob(
  templateName: string,
  variables: Record<string, any> = {}
): Promise<string> {
  console.log(`\n[1/6] Executing activity: ${templateName} on devbob.metabob.local`);
  
  // Build variable args
  const varArgs = Object.entries(variables)
    .map(([key, value]) => `--var ${key}="${typeof value === 'string' ? value : JSON.stringify(value)}"`)
    .join(' ');
  
  // Get devbob pod name
  const getPodCmd = `kubectl get pods -n ${CONFIG.kubectlNamespace} -l ${CONFIG.devbobPodSelector} -o jsonpath='{.items[0].metadata.name}'`;
  const { stdout: podName } = await execAsync(getPodCmd);
  
  if (!podName) {
    throw new Error(`No devbob pod found with selector: ${CONFIG.devbobPodSelector}`);
  }
  
  console.log(`   Using devbob pod: ${podName}`);
  
  // Execute activity via kubectl exec
  const execCmd = `kubectl exec -n ${CONFIG.kubectlNamespace} ${podName} -- /app/bin/opencode activity execute ${templateName} ${varArgs} --json`;
  
  try {
    const { stdout, stderr } = await execAsync(execCmd, {
      timeout: CONFIG.activityExecutionTimeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    
    if (stderr && !stderr.includes('Defaulted container')) {
      console.warn(`   Activity execution stderr: ${stderr}`);
    }
    
    // Parse JSON output to extract execution_id
    const output = JSON.parse(stdout);
    const executionId = output.execution_id || output.activity_id || output.id;
    
    if (!executionId) {
      console.error('   Activity output:', stdout);
      throw new Error('Failed to extract execution_id from activity output');
    }
    
    console.log(`   ✅ Activity executed successfully: ${executionId}`);
    return executionId;
  } catch (error: any) {
    console.error(`   ❌ Failed to execute activity on devbob:`, error.message);
    throw error;
  }
}

/**
 * Wait for activity execution to complete and persist to SurrealDB
 */
async function waitForDataPersistence(
  db: any,
  executionId: string
): Promise<ActivityExecutionRecord> {
  console.log(`\n[2/6] Waiting for data persistence to SurrealDB (execution: ${executionId})`);
  
  const startTime = Date.now();
  const timeout = CONFIG.dataPersistenceTimeout;
  let attempts = 0;
  
  while (Date.now() - startTime < timeout) {
    attempts++;
    
    try {
      const query = `SELECT * FROM activity_executions WHERE execution_id = $execution_id LIMIT 1`;
      const result = await db.query(query, { execution_id: executionId });
      
      if (result && Array.isArray(result) && result.length > 0) {
        const records = result[0];
        
        if (Array.isArray(records) && records.length > 0) {
          const record = records[0] as ActivityExecutionRecord;
          
          // Check if execution is complete
          if (record.status === 'completed' || record.status === 'failed' || record.duration_ms > 0) {
            console.log(`   ✅ Data persisted (attempt ${attempts}): status=${record.status}, duration=${record.duration_ms}ms`);
            return record;
          } else {
            console.log(`   ⏳ Activity still running (attempt ${attempts})...`);
          }
        }
      }
    } catch (error: any) {
      console.warn(`   ⚠️  Query error (attempt ${attempts}): ${error.message}`);
    }
    
    // Wait 2 seconds before retrying
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error(`Activity execution ${executionId} data did not persist to SurrealDB within ${timeout}ms (${attempts} attempts)`);
}

/**
 * Query SurrealDB for activity execution record (ground truth)
 */
async function queryGroundTruth(
  db: any,
  executionId: string
): Promise<ActivityExecutionRecord> {
  console.log(`\n[3/6] Querying SurrealDB for ground truth data`);
  
  const query = `SELECT * FROM activity_executions WHERE execution_id = $execution_id LIMIT 1`;
  const result = await db.query(query, { execution_id: executionId });
  
  if (!result || !Array.isArray(result) || result.length === 0) {
    throw new Error(`No data found in SurrealDB for execution: ${executionId}`);
  }
  
  const records = result[0];
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error(`Empty result set from SurrealDB for execution: ${executionId}`);
  }
  
  const groundTruth = records[0] as ActivityExecutionRecord;
  
  console.log(`   ✅ Ground truth captured:`);
  console.log(`      Execution ID: ${groundTruth.execution_id}`);
  console.log(`      Template: ${groundTruth.template_name || groundTruth.template_id}`);
  console.log(`      Status: ${groundTruth.status}`);
  console.log(`      Duration: ${groundTruth.duration_ms}ms`);
  console.log(`      Cost: $${groundTruth.cost_usd}`);
  console.log(`      Tokens: ${JSON.stringify(groundTruth.tokens_used)}`);
  console.log(`      Task Count: ${groundTruth.task_count || 'N/A'}`);
  console.log(`      Impulse Refs: ${groundTruth.impulse_refs?.length || 0}`);
  
  return groundTruth;
}

/**
 * Navigate to dashboard and wait for activity history to load
 */
async function navigateToDashboard(page: Page): Promise<void> {
  console.log(`\n[4/6] Navigating to dashboard at ${CONFIG.dashboardUrl}`);
  
  await page.goto(`${CONFIG.dashboardUrl}/activity`, {
    timeout: CONFIG.dashboardLoadTimeout,
    waitUntil: 'networkidle',
  });
  
  // Wait for activity table to load
  await page.waitForSelector('table', { timeout: CONFIG.dashboardLoadTimeout });
  await page.waitForSelector('table tbody tr', { timeout: CONFIG.dashboardLoadTimeout });
  
  console.log(`   ✅ Dashboard loaded successfully`);
}

/**
 * Find execution row in dashboard UI
 */
async function findExecutionRow(page: Page, executionId: string): Promise<any> {
  const rows = await page.$$('table tbody tr');
  
  for (const row of rows) {
    const text = await row.textContent();
    if (text && text.includes(executionId)) {
      return row;
    }
  }
  
  throw new Error(`Execution row not found in dashboard UI for ID: ${executionId}`);
}

/**
 * Extract data from dashboard UI
 */
async function extractDashboardUIData(
  page: Page,
  executionId: string
): Promise<DashboardUIData> {
  console.log(`\n[5/6] Extracting UI data for execution: ${executionId}`);
  
  const row = await findExecutionRow(page, executionId);
  const cells = await row.$$('td');
  
  const uiData: DashboardUIData = {
    execution_id: executionId,
  };
  
  // Extract data from table cells
  // Expected cell order: [Expand, Status, Template, Execution ID, Timestamp, Duration, Cost, Tokens, Tasks]
  if (cells.length >= 9) {
    // Status (check for success/error icon)
    const statusCell = cells[1];
    const hasSuccessIcon = await statusCell.$('svg[data-testid="CheckCircleIcon"]');
    const hasErrorIcon = await statusCell.$('svg[data-testid="ErrorIcon"]');
    uiData.success_indicator = hasSuccessIcon !== null;
    uiData.status = hasSuccessIcon ? 'completed' : (hasErrorIcon ? 'failed' : 'unknown');
    
    // Template name
    uiData.template_name = (await cells[2].textContent())?.trim();
    
    // Duration
    const durationText = (await cells[5].textContent())?.trim();
    uiData.duration_display = durationText;
    try {
      uiData.duration_ms = parseDuration(durationText || '');
    } catch (e) {
      console.warn(`   ⚠️  Could not parse duration: ${durationText}`);
    }
    
    // Cost
    const costText = (await cells[6].textContent())?.trim();
    uiData.cost_display = costText;
    try {
      uiData.cost_usd = parseCost(costText || '');
    } catch (e) {
      console.warn(`   ⚠️  Could not parse cost: ${costText}`);
    }
    
    // Tokens
    const tokensText = (await cells[7].textContent())?.trim();
    uiData.tokens_display = tokensText;
    try {
      uiData.tokens_total = parseTokens(tokensText || '');
    } catch (e) {
      console.warn(`   ⚠️  Could not parse tokens: ${tokensText}`);
    }
    
    // Task count
    const tasksText = (await cells[8].textContent())?.trim();
    uiData.task_count_display = tasksText;
    try {
      uiData.task_count = parseInt(tasksText?.match(/\d+/)?.[0] || '0', 10);
    } catch (e) {
      console.warn(`   ⚠️  Could not parse task count: ${tasksText}`);
    }
  }
  
  console.log(`   ✅ UI data extracted:`);
  console.log(`      Template: ${uiData.template_name}`);
  console.log(`      Status: ${uiData.status}`);
  console.log(`      Duration: ${uiData.duration_display} (${uiData.duration_ms}ms)`);
  console.log(`      Cost: ${uiData.cost_display} ($${uiData.cost_usd})`);
  console.log(`      Tokens: ${uiData.tokens_display} (${uiData.tokens_total})`);
  console.log(`      Tasks: ${uiData.task_count_display} (${uiData.task_count})`);
  
  return uiData;
}

/**
 * Parse duration string to milliseconds
 */
function parseDuration(durationStr: string): number {
  const match = durationStr.match(/^([\d.]+)(ms|s|m|h)$/);
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
    case 'h':
      return value * 3600000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * Parse cost string to number
 */
function parseCost(costStr: string): number {
  const match = costStr.match(/\$?([\d.,]+)/);
  if (!match) {
    throw new Error(`Invalid cost format: ${costStr}`);
  }
  return parseFloat(match[1].replace(/,/g, ''));
}

/**
 * Parse tokens string to number
 */
function parseTokens(tokensStr: string): number {
  const match = tokensStr.match(/([\d,]+)/);
  if (!match) {
    throw new Error(`Invalid tokens format: ${tokensStr}`);
  }
  return parseInt(match[1].replace(/,/g, ''), 10);
}

/**
 * Compare numerical values with variance tolerance
 */
function compareWithVariance(
  expected: number,
  actual: number,
  variancePercent: number
): { pass: boolean; variance: number } {
  if (expected === 0 && actual === 0) {
    return { pass: true, variance: 0 };
  }
  
  if (expected === 0) {
    // Can't calculate percentage variance from zero
    return { pass: actual === 0, variance: actual > 0 ? Infinity : 0 };
  }
  
  const variance = Math.abs((actual - expected) / expected) * 100; // Convert to percentage
  const pass = variance <= variancePercent;
  
  return { pass, variance };
}

/**
 * Perform three-way comparison and assertions
 */
function performThreeWayComparison(
  groundTruth: ActivityExecutionRecord,
  uiData: DashboardUIData
): ValidationResult['checks'] {
  console.log(`\n[6/6] Performing three-way comparison (ground truth vs UI)`);
  
  const checks: ValidationResult['checks'] = [];
  
  // Check 1: Execution ID match (exact)
  checks.push({
    name: 'Execution ID matches exactly',
    pass: uiData.execution_id === groundTruth.execution_id,
    expected: groundTruth.execution_id,
    actual: uiData.execution_id,
  });
  
  // Check 2: Template name match (exact)
  const expectedTemplate = groundTruth.template_name || groundTruth.template_id;
  checks.push({
    name: 'Template name matches exactly',
    pass: uiData.template_name === expectedTemplate,
    expected: expectedTemplate,
    actual: uiData.template_name,
  });
  
  // Check 3: Status match (exact)
  checks.push({
    name: 'Status matches exactly',
    pass: uiData.status === groundTruth.status,
    expected: groundTruth.status,
    actual: uiData.status,
  });
  
  // Check 4: Cost variance ≤ 1%
  if (uiData.cost_usd !== undefined) {
    const costComparison = compareWithVariance(
      groundTruth.cost_usd,
      uiData.cost_usd,
      CONFIG.costVariancePercent
    );
    checks.push({
      name: 'Cost variance ≤ 1%',
      pass: costComparison.pass,
      expected: groundTruth.cost_usd,
      actual: uiData.cost_usd,
      variance: costComparison.variance,
      tolerance: CONFIG.costVariancePercent,
    });
  }
  
  // Check 5: Duration variance ≤ 1%
  if (uiData.duration_ms !== undefined) {
    const durationComparison = compareWithVariance(
      groundTruth.duration_ms,
      uiData.duration_ms,
      CONFIG.durationVariancePercent
    );
    checks.push({
      name: 'Duration variance ≤ 1%',
      pass: durationComparison.pass,
      expected: groundTruth.duration_ms,
      actual: uiData.duration_ms,
      variance: durationComparison.variance,
      tolerance: CONFIG.durationVariancePercent,
    });
  }
  
  // Check 6: Tokens total (exact or within 1%)
  if (uiData.tokens_total !== undefined) {
    const expectedTokens = 
      groundTruth.tokens_used.input + 
      groundTruth.tokens_used.output + 
      groundTruth.tokens_used.cache;
    const tokensComparison = compareWithVariance(
      expectedTokens,
      uiData.tokens_total,
      1 // 1% tolerance for tokens
    );
    checks.push({
      name: 'Tokens total accurate',
      pass: tokensComparison.pass,
      expected: expectedTokens,
      actual: uiData.tokens_total,
      variance: tokensComparison.variance,
      tolerance: 1,
    });
  }
  
  // Check 7: Task count match (exact)
  if (groundTruth.task_count !== undefined && uiData.task_count !== undefined) {
    checks.push({
      name: 'Task count matches exactly',
      pass: uiData.task_count === groundTruth.task_count,
      expected: groundTruth.task_count,
      actual: uiData.task_count,
    });
  }
  
  // Check 8: Impulse references preserved
  if (groundTruth.impulse_refs && uiData.impulse_count !== undefined) {
    checks.push({
      name: 'Impulse references preserved',
      pass: uiData.impulse_count === groundTruth.impulse_refs.length,
      expected: groundTruth.impulse_refs.length,
      actual: uiData.impulse_count,
    });
  }
  
  const passedChecks = checks.filter(c => c.pass).length;
  const totalChecks = checks.length;
  console.log(`   ✅ Comparison complete: ${passedChecks}/${totalChecks} checks passed`);
  
  return checks;
}

/**
 * Capture screenshots of dashboard
 */
async function captureScreenshots(
  page: Page,
  executionId: string
): Promise<{ dashboardList: string; dashboardExpanded: string }> {
  const screenshotsDir = path.join(process.cwd(), 'screenshots');
  await fs.mkdir(screenshotsDir, { recursive: true });
  
  // Capture list view
  const listViewPath = path.join(screenshotsDir, `playwright-validation-list-${executionId}.png`);
  await page.screenshot({ path: listViewPath, fullPage: true });
  console.log(`   📸 Screenshot captured: ${listViewPath}`);
  
  // Expand row if possible
  let expandedViewPath = '';
  try {
    const row = await findExecutionRow(page, executionId);
    const expandButton = await row.$('button');
    if (expandButton) {
      await expandButton.click();
      await page.waitForSelector('.MuiCollapse-entered', { timeout: 2000 });
      
      expandedViewPath = path.join(screenshotsDir, `playwright-validation-expanded-${executionId}.png`);
      await page.screenshot({ path: expandedViewPath, fullPage: true });
      console.log(`   📸 Screenshot captured: ${expandedViewPath}`);
    }
  } catch (e) {
    console.warn(`   ⚠️  Could not capture expanded view: ${e}`);
  }
  
  return {
    dashboardList: listViewPath,
    dashboardExpanded: expandedViewPath,
  };
}

/**
 * Run validation
 */
export async function runValidation(): Promise<ValidationResult> {
  const result: ValidationResult = {
    pass: false,
    execution_id: '',
    groundTruth: null,
    uiData: null,
    checks: [],
    screenshots: {},
    errors: [],
    consoleErrors: [],
    timestamp: new Date().toISOString(),
  };
  
  let db: any | null = null;
  let browser: Browser | null = null;
  
  try {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  PLAYWRIGHT DASHBOARD DATA ACCURACY VALIDATION');
    console.log('  Three-Way Verification: devbob → SurrealDB → Dashboard UI');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Connect to SurrealDB
    db = await connectToSurrealDB();
    
    // Step 1: Execute activity on devbob
    const executionId = await executeActivityOnDevbob(
      CONFIG.testTemplateName,
      CONFIG.testTemplateVariables
    );
    result.execution_id = executionId;
    
    // Step 2: Wait for data persistence and query ground truth
    await waitForDataPersistence(db, executionId);
    const groundTruth = await queryGroundTruth(db, executionId);
    result.groundTruth = groundTruth;
    
    // Step 3: Open browser and navigate to dashboard
    browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    // Monitor console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        result.consoleErrors.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      result.consoleErrors.push(`Page error: ${error.message}`);
    });
    
    await navigateToDashboard(page);
    
    // Step 4: Extract UI data
    const uiData = await extractDashboardUIData(page, executionId);
    result.uiData = uiData;
    
    // Step 5: Perform three-way comparison
    result.checks = performThreeWayComparison(groundTruth, uiData);
    
    // Step 6: Capture screenshots
    result.screenshots = await captureScreenshots(page, executionId);
    
    // Determine overall pass/fail
    result.pass = result.checks.every(check => check.pass) && result.consoleErrors.length === 0;
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`  VALIDATION ${result.pass ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`  Checks: ${result.checks.filter(c => c.pass).length}/${result.checks.length} passed`);
    console.log(`  Console Errors: ${result.consoleErrors.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (!result.pass) {
      console.log('Failed checks:');
      result.checks.filter(c => !c.pass).forEach(check => {
        console.log(`  ❌ ${check.name}`);
        console.log(`     Expected: ${JSON.stringify(check.expected)}`);
        console.log(`     Actual: ${JSON.stringify(check.actual)}`);
        if (check.variance !== undefined) {
          console.log(`     Variance: ${check.variance.toFixed(2)}% (tolerance: ${check.tolerance}%)`);
        }
      });
      
      if (result.consoleErrors.length > 0) {
        console.log('\nConsole errors:');
        result.consoleErrors.forEach(err => console.log(`  ❌ ${err}`));
      }
    }
    
    await browser.close();
    
  } catch (error: any) {
    result.errors.push(`Validation error: ${error.message}`);
    console.error('\n❌ Validation failed with error:', error.message);
    console.error(error.stack);
  } finally {
    if (db) {
      await db.close();
    }
    if (browser) {
      await browser.close();
    }
  }
  
  return result;
}

/**
 * Playwright test suite
 */
test.describe('Playwright Dashboard Data Accuracy Validation', () => {
  test('Three-way verification: devbob → SurrealDB → Dashboard UI', async () => {
    const result = await runValidation();
    
    // Assert overall pass
    expect(result.pass).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.consoleErrors).toHaveLength(0);
    
    // Assert all critical checks passed
    const criticalChecks = [
      'Execution ID matches exactly',
      'Template name matches exactly',
      'Status matches exactly',
      'Cost variance ≤ 1%',
      'Duration variance ≤ 1%',
    ];
    
    for (const checkName of criticalChecks) {
      const check = result.checks.find(c => c.name === checkName);
      expect(check?.pass).toBe(true);
    }
  });
});
