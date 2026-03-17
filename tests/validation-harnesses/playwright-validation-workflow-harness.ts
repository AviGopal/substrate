#!/usr/bin/env bun
/**
 * Validation Harness: Playwright Validation Workflow
 * 
 * This harness validates that the playwright-validation-workflow specification
 * is fully implemented and functional by executing the automated validation script
 * and verifying all outputs meet expected criteria.
 * 
 * Validation Strategy:
 * 1. Execute validate-deployment-playwright.sh script
 * 2. Verify pod status checks (kubectl integration)
 * 3. Verify port-forward setup (localhost:8080)
 * 4. Verify health endpoint validation (200 OK with Playwright)
 * 5. Verify session creation validation (201 with Base64 token via Playwright)
 * 6. Verify screenshot capture with timestamps
 * 7. Verify FINAL_VALIDATION_REPORT.md generation
 * 8. Verify pass/fail status and overall compliance
 * 
 * Pass Criteria:
 * - Script executes successfully (exit code 0)
 * - All pods are running
 * - Health check passes (200 OK)
 * - Session creation passes (201 with token)
 * - 2 screenshots captured with timestamp naming
 * - FINAL_VALIDATION_REPORT.md generated
 * - Report contains pass/fail status
 * - Overall pass rate 100%
 * - No manual intervention required
 * 
 * Specification: playwright-validation-workflow
 */

import { spawn } from 'bun';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';

// Configuration
const CONFIG = {
  scriptPath: resolve(process.cwd(), 'scripts/validate-deployment-playwright.sh'),
  reportPath: resolve(process.cwd(), 'FINAL_VALIDATION_REPORT.md'),
  screenshotsDir: resolve(process.cwd(), 'screenshots'),
  namespace: 'activity-system',
  apiPort: 8080,
  
  // Expected outputs
  expectedTests: 2, // health check + session creation
  expectedScreenshots: 2,
  expectedPassRate: 100,
  
  // Timeouts
  scriptTimeout: 120000, // 2 minutes
};

/**
 * Validation result interface
 */
export interface ValidationResult {
  pass: boolean;
  actual: {
    scriptExitCode: number;
    scriptOutput: string;
    reportExists: boolean;
    reportContent?: string;
    screenshotsFound: number;
    screenshots: string[];
    overallStatus?: string;
    passRate?: string;
    testsExecuted?: number;
  };
  expected: {
    scriptExitCode: 0;
    reportExists: true;
    screenshotsFound: number;
    overallStatus: 'PASS';
    passRate: string;
    testsExecuted: number;
  };
  errors: string[];
  summary: string;
}

/**
 * Execute the validation script
 */
async function executeValidationScript(): Promise<{ exitCode: number; output: string; error: string }> {
  console.log(`[INFO] Executing validation script: ${CONFIG.scriptPath}`);
  
  if (!existsSync(CONFIG.scriptPath)) {
    throw new Error(`Validation script not found: ${CONFIG.scriptPath}`);
  }
  
  // Check if script is executable
  try {
    const stats = statSync(CONFIG.scriptPath);
    const isExecutable = (stats.mode & 0o111) !== 0;
    if (!isExecutable) {
      throw new Error(`Script is not executable: ${CONFIG.scriptPath}`);
    }
  } catch (error: any) {
    throw new Error(`Failed to check script permissions: ${error.message}`);
  }
  
  return new Promise((resolve, reject) => {
    const proc = spawn([CONFIG.scriptPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    let stdout = '';
    let stderr = '';
    
    const stdoutReader = proc.stdout.getReader();
    const stderrReader = proc.stderr.getReader();
    
    // Read stdout
    (async () => {
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await stdoutReader.read();
        if (done) break;
        stdout += decoder.decode(value);
      }
    })();
    
    // Read stderr
    (async () => {
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await stderrReader.read();
        if (done) break;
        stderr += decoder.decode(value);
      }
    })();
    
    // Wait for completion with timeout
    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error(`Script execution timeout after ${CONFIG.scriptTimeout}ms`));
    }, CONFIG.scriptTimeout);
    
    proc.exited.then((exitCode) => {
      clearTimeout(timeout);
      resolve({
        exitCode: exitCode || 1,
        output: stdout,
        error: stderr,
      });
    }).catch((error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * Verify report file exists and parse content
 */
function verifyReport(): { exists: boolean; content?: string; status?: string; passRate?: string; testsExecuted?: number } {
  console.log(`[INFO] Verifying report: ${CONFIG.reportPath}`);
  
  if (!existsSync(CONFIG.reportPath)) {
    return { exists: false };
  }
  
  const content = readFileSync(CONFIG.reportPath, 'utf-8');
  
  // Parse overall status
  const statusMatch = content.match(/## Overall Status: (\w+)/);
  const status = statusMatch ? statusMatch[1] : undefined;
  
  // Parse pass rate
  const passRateMatch = content.match(/\*\*Pass Rate\*\*: (\d+)%/);
  const passRate = passRateMatch ? passRateMatch[1] + '%' : undefined;
  
  // Count tests executed
  const testSections = content.match(/###.*Test \d+:/g);
  const testsExecuted = testSections ? testSections.length : 0;
  
  return {
    exists: true,
    content,
    status,
    passRate,
    testsExecuted,
  };
}

/**
 * Verify screenshots exist with correct naming
 */
function verifyScreenshots(): { count: number; files: string[] } {
  console.log(`[INFO] Verifying screenshots in: ${CONFIG.screenshotsDir}`);
  
  if (!existsSync(CONFIG.screenshotsDir)) {
    return { count: 0, files: [] };
  }
  
  const files = readdirSync(CONFIG.screenshotsDir);
  
  // Filter for validation screenshots (01-activity-api-health, 02-session-creation)
  const validationScreenshots = files.filter(f => 
    f.match(/^0[12]-(activity-api-health|session-creation)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/) &&
    f.endsWith('.png')
  );
  
  return {
    count: validationScreenshots.length,
    files: validationScreenshots.sort(),
  };
}

/**
 * Run validation harness
 */
export async function runValidation(input?: any): Promise<ValidationResult> {
  console.log('='.repeat(80));
  console.log('PLAYWRIGHT VALIDATION WORKFLOW - HARNESS');
  console.log('='.repeat(80));
  console.log();
  
  const errors: string[] = [];
  let scriptExitCode = -1;
  let scriptOutput = '';
  
  try {
    // Step 1: Execute validation script
    console.log('[STEP 1] Executing validation script...');
    const scriptResult = await executeValidationScript();
    scriptExitCode = scriptResult.exitCode;
    scriptOutput = scriptResult.output;
    
    console.log(`[RESULT] Script exit code: ${scriptExitCode}`);
    if (scriptExitCode !== 0) {
      errors.push(`Script failed with exit code ${scriptExitCode}`);
      console.log(`[ERROR] Script output:\n${scriptOutput}`);
      if (scriptResult.error) {
        console.log(`[ERROR] Script errors:\n${scriptResult.error}`);
      }
    }
    
    // Step 2: Verify report
    console.log('[STEP 2] Verifying report...');
    const report = verifyReport();
    
    if (!report.exists) {
      errors.push('FINAL_VALIDATION_REPORT.md not generated');
    } else {
      console.log(`[RESULT] Report exists: ${CONFIG.reportPath}`);
      console.log(`[RESULT] Overall status: ${report.status}`);
      console.log(`[RESULT] Pass rate: ${report.passRate}`);
      console.log(`[RESULT] Tests executed: ${report.testsExecuted}`);
      
      if (report.status !== 'PASS') {
        errors.push(`Overall status is ${report.status}, expected PASS`);
      }
      
      if (report.passRate !== '100%') {
        errors.push(`Pass rate is ${report.passRate}, expected 100%`);
      }
      
      if (report.testsExecuted !== CONFIG.expectedTests) {
        errors.push(`Only ${report.testsExecuted} tests executed, expected ${CONFIG.expectedTests}`);
      }
    }
    
    // Step 3: Verify screenshots
    console.log('[STEP 3] Verifying screenshots...');
    const screenshots = verifyScreenshots();
    
    console.log(`[RESULT] Screenshots found: ${screenshots.count}`);
    screenshots.files.forEach(f => console.log(`  - ${f}`));
    
    if (screenshots.count < CONFIG.expectedScreenshots) {
      errors.push(`Only ${screenshots.count} screenshots found, expected ${CONFIG.expectedScreenshots}`);
    }
    
    // Verify screenshot naming convention (timestamp included)
    for (const file of screenshots.files) {
      if (!file.match(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/)) {
        errors.push(`Screenshot ${file} missing timestamp in filename`);
      }
    }
    
    // Build result
    const pass = errors.length === 0 && scriptExitCode === 0;
    
    const result: ValidationResult = {
      pass,
      actual: {
        scriptExitCode,
        scriptOutput: scriptOutput.substring(0, 500), // Truncate for readability
        reportExists: report.exists,
        reportContent: report.content?.substring(0, 1000), // Truncate
        screenshotsFound: screenshots.count,
        screenshots: screenshots.files,
        overallStatus: report.status,
        passRate: report.passRate,
        testsExecuted: report.testsExecuted,
      },
      expected: {
        scriptExitCode: 0,
        reportExists: true,
        screenshotsFound: CONFIG.expectedScreenshots,
        overallStatus: 'PASS',
        passRate: '100%',
        testsExecuted: CONFIG.expectedTests,
      },
      errors,
      summary: pass
        ? `✅ PASS: Playwright validation workflow is fully functional. Script executed successfully, report generated, ${screenshots.count} screenshots captured.`
        : `❌ FAIL: Playwright validation workflow has issues. Errors: ${errors.join('; ')}`,
    };
    
    console.log();
    console.log('='.repeat(80));
    console.log(result.summary);
    console.log('='.repeat(80));
    
    return result;
    
  } catch (error: any) {
    console.error(`[FATAL] Validation harness failed: ${error.message}`);
    
    return {
      pass: false,
      actual: {
        scriptExitCode,
        scriptOutput: scriptOutput || error.message,
        reportExists: false,
        screenshotsFound: 0,
        screenshots: [],
      },
      expected: {
        scriptExitCode: 0,
        reportExists: true,
        screenshotsFound: CONFIG.expectedScreenshots,
        overallStatus: 'PASS',
        passRate: '100%',
        testsExecuted: CONFIG.expectedTests,
      },
      errors: [error.message],
      summary: `❌ FAIL: Validation harness encountered fatal error: ${error.message}`,
    };
  }
}

// Export for use as a module
export default runValidation;
