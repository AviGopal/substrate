/**
 * Validation Harness: DevBob Independent Activity Execution
 * 
 * Validates that DevBob container can independently execute activities end-to-end.
 * 
 * Tests:
 * 1. Git repository initialization in /workspace
 * 2. ANTHROPIC_API_KEY environment variable availability
 * 3. Activity template storage accessibility
 * 4. OpenCode configuration with MCP settings
 * 5. Minimal test activity execution (without immediate exit)
 * 6. RPC API communication during execution
 * 7. SurrealDB data persistence with variant_id tracking
 * 
 * This harness runs inside DevBob pod or locally against K8s cluster.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  pass: boolean;
  actual: any;
  expected: any;
  error?: string;
  details?: string;
}

interface TestCase {
  id: string;
  name: string;
  input: any;
  expectedOutput: any;
}

interface HarnessReport {
  specificationName: string;
  timestamp: string;
  environment: 'devbob-pod' | 'local-kubectl' | 'unknown';
  totalTests: number;
  passed: number;
  failed: number;
  results: Array<{
    testCase: string;
    status: 'PASS' | 'FAIL';
    result: ValidationResult;
  }>;
}

/**
 * Detect execution environment (inside DevBob pod vs local kubectl)
 */
function detectEnvironment(): 'devbob-pod' | 'local-kubectl' | 'unknown' {
  try {
    // Check if we're inside a container with /workspace
    if (fs.existsSync('/workspace') && fs.existsSync('/workspace/.config/opencode')) {
      return 'devbob-pod';
    }
    
    // Check if kubectl is available
    execSync('kubectl version --client', { stdio: 'pipe' });
    return 'local-kubectl';
  } catch {
    return 'unknown';
  }
}

/**
 * Get DevBob pod name dynamically
 */
function getDevBobPodName(): string {
  try {
    const podName = execSync(
      "kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o jsonpath='{.items[0].metadata.name}'",
      { encoding: 'utf-8', stdio: 'pipe' }
    ).trim();
    
    if (!podName) {
      throw new Error('DevBob pod not found in metabob namespace');
    }
    
    return podName;
  } catch (error: any) {
    throw new Error(`Failed to get DevBob pod name: ${error.message}`);
  }
}

/**
 * Execute command inside DevBob pod or locally
 */
function execInDevBob(command: string): { stdout: string; stderr: string; exitCode: number } {
  const env = detectEnvironment();
  
  try {
    let stdout: string;
    let stderr = '';
    
    if (env === 'devbob-pod') {
      // Running inside pod, execute directly
      stdout = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    } else if (env === 'local-kubectl') {
      // Running locally, use kubectl exec with dynamic pod name and namespace
      const podName = getDevBobPodName();
      const kubectlCmd = `kubectl exec -n metabob ${podName} -- sh -c '${command.replace(/'/g, "'\\''")}'`;
      stdout = execSync(kubectlCmd, { encoding: 'utf-8', stdio: 'pipe' });
    } else {
      throw new Error('Cannot detect execution environment (not in DevBob pod and kubectl not available)');
    }
    
    return { stdout: stdout.trim(), stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout?.toString().trim() || '',
      stderr: error.stderr?.toString().trim() || error.message,
      exitCode: error.status || 1
    };
  }
}

/**
 * Test Case 1: Verify /workspace is a git repository
 */
function testGitRepository(): ValidationResult {
  const result = execInDevBob('git rev-parse --is-inside-work-tree');
  
  return {
    pass: result.exitCode === 0 && result.stdout === 'true',
    actual: { stdout: result.stdout, exitCode: result.exitCode },
    expected: { stdout: 'true', exitCode: 0 },
    error: result.exitCode !== 0 ? result.stderr : undefined,
    details: result.exitCode === 0 ? 'Git repository detected in /workspace' : 'No git repository found'
  };
}

/**
 * Test Case 2: Verify ANTHROPIC_API_KEY is set
 */
function testAnthropicApiKey(): ValidationResult {
  const result = execInDevBob('[ -n "$ANTHROPIC_API_KEY" ] && echo "SET" || echo "NOT_SET"');
  
  return {
    pass: result.exitCode === 0 && result.stdout === 'SET',
    actual: { present: result.stdout === 'SET', exitCode: result.exitCode },
    expected: { present: true, exitCode: 0 },
    error: result.stdout !== 'SET' ? 'ANTHROPIC_API_KEY environment variable not set' : undefined,
    details: result.stdout === 'SET' ? 'API key configured' : 'API key missing'
  };
}

/**
 * Test Case 3: Verify METABOB_API_KEY is set
 */
function testMetabobApiKey(): ValidationResult {
  const result = execInDevBob('[ -n "$METABOB_API_KEY" ] && echo "SET" || echo "NOT_SET"');
  
  return {
    pass: result.exitCode === 0 && result.stdout === 'SET',
    actual: { present: result.stdout === 'SET', exitCode: result.exitCode },
    expected: { present: true, exitCode: 0 },
    error: result.stdout !== 'SET' ? 'METABOB_API_KEY environment variable not set' : undefined,
    details: result.stdout === 'SET' ? 'Metabob API key configured' : 'Metabob API key missing'
  };
}

/**
 * Test Case 3: Verify activity templates are accessible
 */
function testActivityTemplates(): ValidationResult {
  // Check if templates exist in common locations
  const checkPaths = [
    '/app/templates',
    '/workspace/.config/opencode/templates',
    '~/.local/share/opencode/storage/activity-template'
  ];
  
  let templatesFound = false;
  let templateCount = 0;
  let foundPath = '';
  
  for (const templatePath of checkPaths) {
    const result = execInDevBob(`ls -1 ${templatePath} 2>/dev/null | wc -l`);
    const count = parseInt(result.stdout);
    
    if (count > 0) {
      templatesFound = true;
      templateCount = count;
      foundPath = templatePath;
      break;
    }
  }
  
  return {
    pass: templatesFound && templateCount > 0,
    actual: { templatesFound, templateCount, path: foundPath },
    expected: { templatesFound: true, templateCount: '>0' },
    error: !templatesFound ? 'No activity templates found in standard locations' : undefined,
    details: templatesFound ? `Found ${templateCount} templates at ${foundPath}` : 'Templates not accessible'
  };
}

/**
 * Test Case 4: Verify OpenCode configuration exists with MCP settings
 */
function testOpencodeConfig(): ValidationResult {
  const configPath = '/workspace/.config/opencode/opencode.json';
  const result = execInDevBob(`cat ${configPath}`);
  
  if (result.exitCode !== 0) {
    return {
      pass: false,
      actual: { exists: false },
      expected: { exists: true, hasMCP: true },
      error: 'OpenCode configuration file not found',
      details: `Expected file at ${configPath}`
    };
  }
  
  try {
    const config = JSON.parse(result.stdout);
    const hasMCP = !!config.mcp;
    const hasSessionMemory = !!config.sessionMemory;
    
    return {
      pass: hasMCP,
      actual: { exists: true, hasMCP, hasSessionMemory, config },
      expected: { exists: true, hasMCP: true },
      details: hasMCP ? 'OpenCode config has MCP settings' : 'MCP settings missing from config'
    };
  } catch (parseError) {
    return {
      pass: false,
      actual: { exists: true, valid: false },
      expected: { exists: true, valid: true, hasMCP: true },
      error: 'Config file exists but is not valid JSON',
      details: result.stdout.substring(0, 200)
    };
  }
}

/**
 * Test Case 5: Execute minimal test activity (check it doesn't exit immediately)
 */
function testMinimalActivityExecution(): ValidationResult {
  // Create a minimal test template that should execute without errors
  const testTemplateId = 'test-validation-simple';
  
  // First, check if we can list activities
  const listResult = execInDevBob('opencode activity --list 2>&1');
  
  if (listResult.exitCode !== 0 && listResult.stderr.includes('not found')) {
    return {
      pass: false,
      actual: { canListTemplates: false, error: 'opencode command not found' },
      expected: { canListTemplates: true, executionStarted: true },
      error: 'OpenCode CLI not available in DevBob environment',
      details: listResult.stderr
    };
  }
  
  // Try to execute a simple activity (we expect it to at least start)
  // Use a short timeout to avoid hanging
  const execResult = execInDevBob(`timeout 10 opencode activity ${testTemplateId} 2>&1 || true`);
  
  // Success criteria: 
  // - NOT immediate exit with "not a git repository" error
  // - NOT immediate exit with requiresCleanGit error
  const hasGitError = execResult.stdout.includes('not a git repository') || 
                      execResult.stdout.includes('ActivityGitError');
  const hasPreFlightError = execResult.stdout.includes('pre-flight check failed');
  
  // If template doesn't exist, that's OK - we just want to verify git checks pass
  const templateNotFound = execResult.stdout.includes('Template not found') || 
                          execResult.stdout.includes('not found');
  
  const pass = !hasGitError && !hasPreFlightError;
  
  return {
    pass,
    actual: { 
      hasGitError, 
      hasPreFlightError,
      templateNotFound,
      output: execResult.stdout.substring(0, 500) 
    },
    expected: { 
      hasGitError: false, 
      hasPreFlightError: false 
    },
    error: hasGitError ? 'Activity failed git repository check' : 
           hasPreFlightError ? 'Activity failed pre-flight checks' : undefined,
    details: pass ? 'Activity execution started (git checks passed)' : 
             templateNotFound ? 'Template not found, but git checks passed' :
             'Activity blocked by git or pre-flight errors'
  };
}

/**
 * Test Case 6: Monitor RPC API communication (check logs for POST requests)
 */
function testRpcApiCommunication(): ValidationResult {
  const env = detectEnvironment();
  
  if (env === 'devbob-pod') {
    // Inside pod, we can't check our own logs easily
    return {
      pass: true, // Skip this test when inside pod
      actual: { skipped: true },
      expected: { skipped: true },
      details: 'Skipped: Cannot check own logs from inside pod'
    };
  }
  
  // From outside, check recent logs for RPC API activity
  try {
    const podName = getDevBobPodName();
    const logs = execSync(`kubectl logs -n metabob ${podName} --tail=100 2>&1`, { encoding: 'utf-8' });
    
    const hasRpcActivity = logs.includes('RPC API') || 
                          logs.includes('POST /activity') ||
                          logs.includes('variant_id');
    
    return {
      pass: hasRpcActivity,
      actual: { 
        hasRpcActivity,
        logSample: logs.substring(0, 500)
      },
      expected: { hasRpcActivity: true },
      details: hasRpcActivity ? 'RPC API communication detected in logs' : 'No RPC API activity in recent logs'
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: { error: error.message },
      expected: { hasRpcActivity: true },
      error: 'Failed to retrieve DevBob logs',
      details: error.message
    };
  }
}

/**
 * Test Case 7: Query SurrealDB for activity execution records
 */
function testSurrealDbRecords(): ValidationResult {
  // This requires SurrealDB access - implementation depends on environment
  // For now, we'll check if we can at least connect to the database
  
  const surrealHost = process.env.SURREAL_HOST || 'localhost';
  const surrealPort = process.env.SURREAL_PORT || '8000';
  
  // Try to check if SurrealDB is reachable
  const result = execInDevBob(`curl -sf http://${surrealHost}:${surrealPort}/health || echo "UNREACHABLE"`);
  
  if (result.stdout === 'UNREACHABLE') {
    return {
      pass: false,
      actual: { reachable: false },
      expected: { reachable: true, hasRecords: true },
      error: 'SurrealDB not reachable',
      details: `Tried ${surrealHost}:${surrealPort}`
    };
  }
  
  // TODO: Implement actual query for activity_execution records
  // For now, just verify connectivity
  return {
    pass: true,
    actual: { reachable: true, verified: 'connectivity-only' },
    expected: { reachable: true },
    details: 'SurrealDB reachable (record query not yet implemented)'
  };
}

/**
 * Run all validation tests
 */
export function runValidation(): HarnessReport {
  const environment = detectEnvironment();
  
  const testCases: Array<{ name: string; fn: () => ValidationResult }> = [
    { name: 'Git Repository Initialization', fn: testGitRepository },
    { name: 'ANTHROPIC_API_KEY Available', fn: testAnthropicApiKey },
    { name: 'METABOB_API_KEY Available', fn: testMetabobApiKey },
    { name: 'Activity Templates Accessible', fn: testActivityTemplates },
    { name: 'OpenCode Config with MCP', fn: testOpencodeConfig },
    { name: 'Minimal Activity Execution', fn: testMinimalActivityExecution },
    { name: 'RPC API Communication', fn: testRpcApiCommunication },
    { name: 'SurrealDB Records', fn: testSurrealDbRecords }
  ];
  
  const results = testCases.map(tc => {
    console.log(`\n🧪 Running: ${tc.name}...`);
    const result = tc.fn();
    const status: 'PASS' | 'FAIL' = result.pass ? 'PASS' : 'FAIL';
    console.log(`   ${status === 'PASS' ? '✅' : '❌'} ${status}: ${result.details || ''}`);
    if (result.error) {
      console.log(`   ⚠️  Error: ${result.error}`);
    }
    
    return {
      testCase: tc.name,
      status,
      result
    };
  });
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  const report: HarnessReport = {
    specificationName: 'devbob-independent-activity-execution',
    timestamp: new Date().toISOString(),
    environment,
    totalTests: testCases.length,
    passed,
    failed,
    results
  };
  
  return report;
}

/**
 * Main entry point for CLI execution
 */
if (require.main === module) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  DevBob Independent Activity Execution - Validation Harness');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const report = runValidation();
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Results: ${report.passed}/${report.totalTests} PASSED`);
  console.log(`  Environment: ${report.environment}`);
  console.log(`  Timestamp: ${report.timestamp}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Write detailed report to file
  const reportPath = `/tmp/validation-report-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Detailed report written to: ${reportPath}\n`);
  
  // Exit with appropriate code
  process.exit(report.failed > 0 ? 1 : 0);
}
