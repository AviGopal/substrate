/**
 * Validation Harness: SurrealDB Authentication Fix and Dashboard Live Test
 * 
 * Multi-stage validation for fixing 401 Unauthorized errors and demonstrating
 * working dashboard with live activity history data from devbob.metabob.local.
 * 
 * Specification: surrealdb-authentication-fix-and-dashboard-live-test
 * Trace Impulse: trace-surrealdb-authentication-fix-and-dashboard-live-test
 * Enforcement Impulse: enforcement-surrealdb-authentication-fix-and-dashboard-live-test
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface ValidationInput {
  kubectlContext?: string;
  namespace?: string;
  dashboardUrl?: string;
  testEmail?: string;
  testPassword?: string;
  screenshotDir?: string;
}

interface ValidationOutput {
  pass: boolean;
  stage: string;
  actual: any;
  expected: any;
  errors: string[];
  screenshots: string[];
  evidence: {
    credentialsFound: boolean;
    dbConnectionSuccess: boolean;
    dashboardLoginSuccess: boolean;
    activityHistoryLoaded: boolean;
    liveDataFromDevbob: boolean;
  };
}

interface TestCase {
  id: string;
  input: ValidationInput;
  expectedOutput: Partial<ValidationOutput>;
}

// ============================================================================
// Stage 1: Trace SurrealDB Credentials
// ============================================================================

function stage1_traceCredentials(namespace: string): {
  success: boolean;
  credentials: any;
  errors: string[];
} {
  const errors: string[] = [];
  const credentials: any = {};

  try {
    // Check surrealdb-credentials secret
    console.log('Stage 1: Checking surrealdb-credentials secret...');
    const secretCheck = execSync(
      `kubectl get secret surrealdb-credentials -n ${namespace} -o json`,
      { encoding: 'utf-8' }
    );
    const secret = JSON.parse(secretCheck);
    
    if (secret.data) {
      credentials.username = Buffer.from(secret.data.username || '', 'base64').toString();
      credentials.password = Buffer.from(secret.data.password || '', 'base64').toString();
      console.log(`  ✅ Secret found with username: ${credentials.username}`);
    } else {
      errors.push('surrealdb-credentials secret exists but has no data');
    }

    // Check RPC API deployment environment variables
    console.log('Stage 1: Checking metabob-rpc-api deployment env vars...');
    const deploymentCheck = execSync(
      `kubectl get deployment metabob-rpc-api -n ${namespace} -o json`,
      { encoding: 'utf-8' }
    );
    const deployment = JSON.parse(deploymentCheck);
    
    const container = deployment.spec?.template?.spec?.containers?.[0];
    const envVars = container?.env || [];
    
    const surrealdbEnv = {
      SURREALDB_URL: envVars.find((e: any) => e.name === 'SURREALDB_URL')?.value,
      SURREALDB_NAMESPACE: envVars.find((e: any) => e.name === 'SURREALDB_NAMESPACE')?.value,
      SURREALDB_DATABASE: envVars.find((e: any) => e.name === 'SURREALDB_DATABASE')?.value,
      SURREALDB_USERNAME: envVars.find((e: any) => e.name === 'SURREALDB_USERNAME')?.valueFrom,
      SURREALDB_PASSWORD: envVars.find((e: any) => e.name === 'SURREALDB_PASSWORD')?.valueFrom,
    };
    
    credentials.deploymentEnv = surrealdbEnv;
    
    // Validate required env vars are set
    if (!surrealdbEnv.SURREALDB_URL) {
      errors.push('SURREALDB_URL not set in deployment');
    }
    if (!surrealdbEnv.SURREALDB_USERNAME?.secretKeyRef) {
      errors.push('SURREALDB_USERNAME not mounted from secret');
    }
    if (!surrealdbEnv.SURREALDB_PASSWORD?.secretKeyRef) {
      errors.push('SURREALDB_PASSWORD not mounted from secret');
    }

    console.log(`  ${errors.length === 0 ? '✅' : '❌'} Environment variables: ${JSON.stringify(surrealdbEnv, null, 2)}`);

    return {
      success: errors.length === 0,
      credentials,
      errors,
    };
  } catch (error: any) {
    errors.push(`Stage 1 failed: ${error.message}`);
    return { success: false, credentials: {}, errors };
  }
}

// ============================================================================
// Stage 2: Enforce Credential Configuration (if needed)
// ============================================================================

function stage2_enforceConfiguration(
  namespace: string,
  credentialsCheck: ReturnType<typeof stage1_traceCredentials>
): {
  success: boolean;
  applied: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    if (credentialsCheck.success) {
      console.log('Stage 2: Credentials already configured correctly, skipping enforcement');
      return { success: true, applied: false, errors: [] };
    }

    console.log('Stage 2: Applying credential configuration...');
    
    // This would typically involve:
    // 1. Updating Helm values or Kubernetes manifests
    // 2. Applying the changes with kubectl or helm upgrade
    // 3. Waiting for pod restart
    
    // For now, we'll just log what needs to be done
    console.log('  ⚠️  Manual intervention required:');
    console.log('  1. Update helm values or deployment manifest');
    console.log('  2. Ensure SURREALDB_USERNAME and SURREALDB_PASSWORD are mounted from secret');
    console.log('  3. Run: helm upgrade metabob-rpc-api ./helm/charts/metabob-rpc-api -n metabob');
    console.log('  4. Wait for pod restart: kubectl rollout status deployment/metabob-rpc-api -n metabob');
    
    errors.push('Credential configuration requires manual intervention');
    return { success: false, applied: false, errors };
  } catch (error: any) {
    errors.push(`Stage 2 failed: ${error.message}`);
    return { success: false, applied: false, errors };
  }
}

// ============================================================================
// Stage 3: Deploy Changes and Wait for Readiness
// ============================================================================

function stage3_deployAndWait(namespace: string): {
  success: boolean;
  ready: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    console.log('Stage 3: Checking deployment readiness...');
    
    // Check if deployment is ready
    const rolloutStatus = execSync(
      `kubectl rollout status deployment/metabob-rpc-api -n ${namespace} --timeout=30s`,
      { encoding: 'utf-8' }
    );
    
    if (rolloutStatus.includes('successfully rolled out')) {
      console.log('  ✅ Deployment ready');
      return { success: true, ready: true, errors: [] };
    } else {
      errors.push('Deployment not ready');
      return { success: false, ready: false, errors };
    }
  } catch (error: any) {
    if (error.message.includes('timed out')) {
      errors.push('Deployment readiness check timed out');
    } else {
      errors.push(`Stage 3 failed: ${error.message}`);
    }
    return { success: false, ready: false, errors };
  }
}

// ============================================================================
// Stage 4: Validate Database Connection
// ============================================================================

function stage4_validateDatabaseConnection(namespace: string): {
  success: boolean;
  tablesAccessible: string[];
  errors: string[];
} {
  const errors: string[] = [];
  const tablesAccessible: string[] = [];

  try {
    console.log('Stage 4: Validating database connection...');
    
    // Get first RPC API pod
    const podName = execSync(
      `kubectl get pods -n ${namespace} -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}'`,
      { encoding: 'utf-8' }
    );

    if (!podName) {
      errors.push('No RPC API pods found');
      return { success: false, tablesAccessible: [], errors };
    }

    console.log(`  Using pod: ${podName}`);

    // Run CLI validation command
    const validationOutput = execSync(
      `kubectl exec ${podName} -n ${namespace} -- python -m server.cli db validate`,
      { encoding: 'utf-8' }
    );

    console.log('  CLI validation output:');
    console.log(validationOutput);

    // Parse output to check for success indicators
    const expectedTables = [
      'users',
      'organizations',
      'user_organizations',
      'refresh_tokens',
      'activity_executions',
      'template_metrics',
    ];

    for (const table of expectedTables) {
      if (validationOutput.includes(`✅ ${table}`)) {
        tablesAccessible.push(table);
      }
    }

    const allTablesAccessible = expectedTables.every(t => tablesAccessible.includes(t));
    
    if (!validationOutput.includes('✅ Validation successful')) {
      errors.push('Database validation did not complete successfully');
    }

    if (!allTablesAccessible) {
      const missing = expectedTables.filter(t => !tablesAccessible.includes(t));
      errors.push(`Missing tables: ${missing.join(', ')}`);
    }

    console.log(`  ${allTablesAccessible && errors.length === 0 ? '✅' : '❌'} Database connection validated`);

    return {
      success: allTablesAccessible && errors.length === 0,
      tablesAccessible,
      errors,
    };
  } catch (error: any) {
    errors.push(`Stage 4 failed: ${error.message}`);
    return { success: false, tablesAccessible: [], errors };
  }
}

// ============================================================================
// Stage 5: Test Dashboard Login via Playwright
// ============================================================================

async function stage5_testDashboardLogin(
  dashboardUrl: string,
  email: string,
  password: string,
  screenshotDir: string
): Promise<{
  success: boolean;
  redirectedToDashboard: boolean;
  screenshots: string[];
  errors: string[];
}> {
  const errors: string[] = [];
  const screenshots: string[] = [];

  try {
    console.log('Stage 5: Testing dashboard login via Playwright...');

    // Import Playwright dynamically
    const { chromium } = require('playwright');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to login page
    console.log(`  Navigating to ${dashboardUrl}/cloud/login`);
    await page.goto(`${dashboardUrl}/cloud/login`, { waitUntil: 'networkidle' });

    const loginScreenshot = path.join(screenshotDir, 'login-page.png');
    await page.screenshot({ path: loginScreenshot, fullPage: true });
    screenshots.push(loginScreenshot);
    console.log(`  📸 Screenshot: ${loginScreenshot}`);

    // Fill in credentials
    console.log(`  Filling credentials: ${email}`);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);

    const beforeSubmitScreenshot = path.join(screenshotDir, 'login-filled.png');
    await page.screenshot({ path: beforeSubmitScreenshot, fullPage: true });
    screenshots.push(beforeSubmitScreenshot);

    // Click Sign In
    console.log('  Clicking Sign In button...');
    await page.click('button[type="submit"]');

    // Wait for navigation (either to dashboard or error)
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    const afterSubmitScreenshot = path.join(screenshotDir, 'after-login.png');
    await page.screenshot({ path: afterSubmitScreenshot, fullPage: true });
    screenshots.push(afterSubmitScreenshot);

    // Check current URL
    const currentUrl = page.url();
    console.log(`  Current URL after login: ${currentUrl}`);

    const redirectedToDashboard =
      currentUrl.includes('/cloud/dashboard') || currentUrl.includes('/cloud/activity');

    if (!redirectedToDashboard) {
      errors.push(`Login did not redirect to dashboard. Current URL: ${currentUrl}`);
    }

    // Check for error messages
    const errorMessage = await page.locator('.error, .alert-danger, [role="alert"]').textContent().catch(() => null);
    if (errorMessage) {
      errors.push(`Error message displayed: ${errorMessage}`);
    }

    // Check console for 500 errors
    page.on('console', (msg: any) => {
      if (msg.type() === 'error' || msg.text().includes('500')) {
        console.log(`  ⚠️  Console error: ${msg.text()}`);
        errors.push(`Console error: ${msg.text()}`);
      }
    });

    await browser.close();

    console.log(`  ${redirectedToDashboard && errors.length === 0 ? '✅' : '❌'} Dashboard login test`);

    return {
      success: redirectedToDashboard && errors.length === 0,
      redirectedToDashboard,
      screenshots,
      errors,
    };
  } catch (error: any) {
    errors.push(`Stage 5 failed: ${error.message}`);
    return {
      success: false,
      redirectedToDashboard: false,
      screenshots,
      errors,
    };
  }
}

// ============================================================================
// Stage 6: Test Activity History Page
// ============================================================================

async function stage6_testActivityHistory(
  dashboardUrl: string,
  email: string,
  password: string,
  screenshotDir: string
): Promise<{
  success: boolean;
  activityTableDisplayed: boolean;
  activityCount: number;
  screenshots: string[];
  errors: string[];
}> {
  const errors: string[] = [];
  const screenshots: string[] = [];

  try {
    console.log('Stage 6: Testing activity history page...');

    const { chromium } = require('playwright');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login first
    await page.goto(`${dashboardUrl}/cloud/login`);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Navigate to activity history
    console.log('  Navigating to /cloud/activity...');
    await page.goto(`${dashboardUrl}/cloud/activity`, { waitUntil: 'networkidle' });

    const activityPageScreenshot = path.join(screenshotDir, 'activity-history.png');
    await page.screenshot({ path: activityPageScreenshot, fullPage: true });
    screenshots.push(activityPageScreenshot);
    console.log(`  📸 Screenshot: ${activityPageScreenshot}`);

    // Check if activity table is displayed
    const activityTable = await page.locator('.activity-table, table').count();
    const activityTableDisplayed = activityTable > 0;

    if (!activityTableDisplayed) {
      errors.push('Activity table not found on page');
    }

    // Count activity rows
    const activityRows = await page.locator('.activity-row, tbody tr').count();
    console.log(`  Found ${activityRows} activity rows`);

    if (activityRows === 0) {
      errors.push('No activities displayed in table');
    }

    // Try to expand first activity row
    if (activityRows > 0) {
      console.log('  Expanding first activity row...');
      try {
        await page.locator('.activity-row, tbody tr').first().click();
        await page.waitForTimeout(1000); // Wait for expansion animation

        const expandedScreenshot = path.join(screenshotDir, 'activity-expanded.png');
        await page.screenshot({ path: expandedScreenshot, fullPage: true });
        screenshots.push(expandedScreenshot);
        console.log(`  📸 Screenshot: ${expandedScreenshot}`);
      } catch (expandError: any) {
        errors.push(`Failed to expand activity row: ${expandError.message}`);
      }
    }

    await browser.close();

    console.log(`  ${activityTableDisplayed && activityRows > 0 && errors.length === 0 ? '✅' : '❌'} Activity history test`);

    return {
      success: activityTableDisplayed && activityRows > 0 && errors.length === 0,
      activityTableDisplayed,
      activityCount: activityRows,
      screenshots,
      errors,
    };
  } catch (error: any) {
    errors.push(`Stage 6 failed: ${error.message}`);
    return {
      success: false,
      activityTableDisplayed: false,
      activityCount: 0,
      screenshots,
      errors,
    };
  }
}

// ============================================================================
// Stage 7: Verify Live Data from devbob.metabob.local
// ============================================================================

async function stage7_verifyLiveData(
  dashboardUrl: string,
  email: string,
  password: string,
  screenshotDir: string
): Promise<{
  success: boolean;
  devbobDataFound: boolean;
  executionMetadata: any[];
  errors: string[];
}> {
  const errors: string[] = [];
  const executionMetadata: any[] = [];

  try {
    console.log('Stage 7: Verifying live data from devbob.metabob.local...');

    const { chromium } = require('playwright');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login and navigate to activity history
    await page.goto(`${dashboardUrl}/cloud/login`);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.goto(`${dashboardUrl}/cloud/activity`);

    // Extract activity metadata from the page
    const activityText = await page.locator('.activity-row, tbody tr').allTextContents();
    
    console.log('  Checking for devbob.metabob.local in activity metadata...');
    
    let devbobDataFound = false;
    for (const text of activityText) {
      if (text.includes('devbob') || text.includes('metabob.local')) {
        devbobDataFound = true;
        executionMetadata.push({ text, source: 'devbob.metabob.local' });
        console.log(`  ✅ Found devbob data: ${text.substring(0, 100)}...`);
      }
    }

    if (!devbobDataFound) {
      errors.push('No activities from devbob.metabob.local found in activity history');
      console.log('  ⚠️  Activities found but none from devbob.metabob.local');
    }

    await browser.close();

    console.log(`  ${devbobDataFound && errors.length === 0 ? '✅' : '❌'} Live data verification`);

    return {
      success: devbobDataFound && errors.length === 0,
      devbobDataFound,
      executionMetadata,
      errors,
    };
  } catch (error: any) {
    errors.push(`Stage 7 failed: ${error.message}`);
    return {
      success: false,
      devbobDataFound: false,
      executionMetadata: [],
      errors,
    };
  }
}

// ============================================================================
// Main Validation Runner
// ============================================================================

export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const namespace = input.namespace || 'metabob';
  const dashboardUrl = input.dashboardUrl || 'https://app.metabob.local';
  const testEmail = input.testEmail || 'demo@metabob.com';
  const testPassword = input.testPassword || 'password';
  const screenshotDir = input.screenshotDir || '/tmp/validation-screenshots';

  // Create screenshot directory
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const allErrors: string[] = [];
  const allScreenshots: string[] = [];
  let currentStage = 'initialization';

  try {
    // Stage 1: Trace credentials
    currentStage = 'stage1_traceCredentials';
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Stage 1: Trace SurrealDB Credentials');
    console.log('═══════════════════════════════════════════════════════════\n');
    const credentialsCheck = stage1_traceCredentials(namespace);
    allErrors.push(...credentialsCheck.errors);

    // Stage 2: Enforce configuration (if needed)
    currentStage = 'stage2_enforceConfiguration';
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Stage 2: Enforce Credential Configuration');
    console.log('═══════════════════════════════════════════════════════════\n');
    const configEnforcement = stage2_enforceConfiguration(namespace, credentialsCheck);
    allErrors.push(...configEnforcement.errors);

    // Stage 3: Deploy and wait for readiness
    currentStage = 'stage3_deployAndWait';
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Stage 3: Deploy Changes and Wait for Readiness');
    console.log('═══════════════════════════════════════════════════════════\n');
    const deploymentCheck = stage3_deployAndWait(namespace);
    allErrors.push(...deploymentCheck.errors);

    // Stage 4: Validate database connection
    currentStage = 'stage4_validateDatabaseConnection';
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Stage 4: Validate Database Connection');
    console.log('═══════════════════════════════════════════════════════════\n');
    const dbValidation = stage4_validateDatabaseConnection(namespace);
    allErrors.push(...dbValidation.errors);

    // Stage 5: Test dashboard login
    currentStage = 'stage5_testDashboardLogin';
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Stage 5: Test Dashboard Login via Playwright');
    console.log('═══════════════════════════════════════════════════════════\n');
    const loginTest = await stage5_testDashboardLogin(dashboardUrl, testEmail, testPassword, screenshotDir);
    allErrors.push(...loginTest.errors);
    allScreenshots.push(...loginTest.screenshots);

    // Stage 6: Test activity history page
    currentStage = 'stage6_testActivityHistory';
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Stage 6: Test Activity History Page');
    console.log('═══════════════════════════════════════════════════════════\n');
    const activityTest = await stage6_testActivityHistory(dashboardUrl, testEmail, testPassword, screenshotDir);
    allErrors.push(...activityTest.errors);
    allScreenshots.push(...activityTest.screenshots);

    // Stage 7: Verify live data from devbob
    currentStage = 'stage7_verifyLiveData';
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Stage 7: Verify Live Data from devbob.metabob.local');
    console.log('═══════════════════════════════════════════════════════════\n');
    const liveDataCheck = await stage7_verifyLiveData(dashboardUrl, testEmail, testPassword, screenshotDir);
    allErrors.push(...liveDataCheck.errors);

    // Stage 8: Capture evidence summary
    currentStage = 'stage8_captureEvidence';
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Stage 8: Capture Evidence');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total screenshots captured: ${allScreenshots.length}`);
    allScreenshots.forEach(s => console.log(`  - ${s}`));

    // Determine overall pass/fail
    const pass = allErrors.length === 0;

    const output: ValidationOutput = {
      pass,
      stage: currentStage,
      actual: {
        credentialsCheck,
        configEnforcement,
        deploymentCheck,
        dbValidation,
        loginTest,
        activityTest,
        liveDataCheck,
      },
      expected: {
        credentialsFound: true,
        dbConnectionSuccess: true,
        dashboardLoginSuccess: true,
        activityHistoryLoaded: true,
        liveDataFromDevbob: true,
      },
      errors: allErrors,
      screenshots: allScreenshots,
      evidence: {
        credentialsFound: credentialsCheck.success,
        dbConnectionSuccess: dbValidation.success,
        dashboardLoginSuccess: loginTest.success,
        activityHistoryLoaded: activityTest.success,
        liveDataFromDevbob: liveDataCheck.success,
      },
    };

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`VALIDATION ${pass ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Evidence:`);
    console.log(`  - Credentials found: ${output.evidence.credentialsFound ? '✅' : '❌'}`);
    console.log(`  - DB connection success: ${output.evidence.dbConnectionSuccess ? '✅' : '❌'}`);
    console.log(`  - Dashboard login success: ${output.evidence.dashboardLoginSuccess ? '✅' : '❌'}`);
    console.log(`  - Activity history loaded: ${output.evidence.activityHistoryLoaded ? '✅' : '❌'}`);
    console.log(`  - Live data from devbob: ${output.evidence.liveDataFromDevbob ? '✅' : '❌'}`);
    console.log(`\nTotal errors: ${allErrors.length}`);
    if (allErrors.length > 0) {
      console.log('Errors:');
      allErrors.forEach(e => console.log(`  - ${e}`));
    }

    return output;
  } catch (error: any) {
    allErrors.push(`Validation failed at ${currentStage}: ${error.message}`);
    
    return {
      pass: false,
      stage: currentStage,
      actual: { error: error.message, stack: error.stack },
      expected: {
        credentialsFound: true,
        dbConnectionSuccess: true,
        dashboardLoginSuccess: true,
        activityHistoryLoaded: true,
        liveDataFromDevbob: true,
      },
      errors: allErrors,
      screenshots: allScreenshots,
      evidence: {
        credentialsFound: false,
        dbConnectionSuccess: false,
        dashboardLoginSuccess: false,
        activityHistoryLoaded: false,
        liveDataFromDevbob: false,
      },
    };
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const input: ValidationInput = {
    namespace: args[0] || 'metabob',
    dashboardUrl: args[1] || 'https://app.metabob.local',
    testEmail: args[2] || 'demo@metabob.com',
    testPassword: args[3] || 'password',
    screenshotDir: args[4] || '/tmp/validation-screenshots',
  };

  console.log('Starting validation with inputs:');
  console.log(JSON.stringify(input, null, 2));

  runValidation(input)
    .then((result) => {
      console.log('\n\nFinal Result:');
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.pass ? 0 : 1);
    })
    .catch((error) => {
      console.error('Validation error:', error);
      process.exit(1);
    });
}
