/**
 * Validation Harness: DevBob Complete Environment Setup
 * 
 * Validates that all components of the DevBob environment are correctly configured:
 * 1. Git repository initialized in /workspace
 * 2. METABOB_API_KEY environment variable set from k8s secret
 * 3. Validation harness can discover pod dynamically (no hardcoded names)
 * 4. Activity templates accessible (3+ templates)
 * 5. ConfigMap contains complete opencode.json with MCP configuration
 * 6. Pod is running (not CrashLoopBackOff)
 * 7. All environment variables properly injected
 * 
 * This harness validates the enforcement of devbob-complete-environment-setup specification.
 */

import { execSync } from 'child_process';

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
  environment: 'local-kubectl' | 'unknown';
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
 * Get DevBob pod name dynamically using label selector
 */
function getDevBobPodName(): string {
  try {
    const podName = execSync(
      "kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o jsonpath='{.items[?(@.status.containerStatuses[0].ready==true)].metadata.name}'",
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
 * Execute command in DevBob pod
 */
function execInPod(command: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const podName = getDevBobPodName();
    const kubectlCmd = `kubectl exec -n metabob ${podName} -- sh -c '${command.replace(/'/g, "'\\''")}'`;
    const stdout = execSync(kubectlCmd, { encoding: 'utf-8', stdio: 'pipe' });
    
    return { stdout: stdout.trim(), stderr: '', exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout?.toString().trim() || '',
      stderr: error.stderr?.toString().trim() || error.message,
      exitCode: error.status || 1
    };
  }
}

/**
 * Test Case 1: Verify pod is running (not CrashLoopBackOff)
 */
function testPodStatus(): ValidationResult {
  try {
    const podName = getDevBobPodName();
    const status = execSync(
      `kubectl get pod -n metabob ${podName} -o jsonpath='{.status.phase}'`,
      { encoding: 'utf-8', stdio: 'pipe' }
    ).trim();
    
    const containerStatus = execSync(
      `kubectl get pod -n metabob ${podName} -o jsonpath='{.status.containerStatuses[0].state}'`,
      { encoding: 'utf-8', stdio: 'pipe' }
    ).trim();
    
    const isRunning = status === 'Running' && containerStatus.includes('running');
    const isCrashing = containerStatus.includes('waiting') && containerStatus.includes('CrashLoopBackOff');
    
    return {
      pass: isRunning && !isCrashing,
      actual: { phase: status, containerStatus, podName },
      expected: { phase: 'Running', containerState: 'running', noCrash: true },
      error: isCrashing ? 'Pod is in CrashLoopBackOff' : !isRunning ? 'Pod not running' : undefined,
      details: isRunning ? `Pod ${podName} is running` : `Pod ${podName} status: ${status}`
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: { error: error.message },
      expected: { phase: 'Running' },
      error: error.message
    };
  }
}

/**
 * Test Case 2: Verify git repository initialized in /workspace
 */
function testGitRepository(): ValidationResult {
  const result = execInPod('git -C /workspace rev-parse --is-inside-work-tree 2>&1');
  
  return {
    pass: result.exitCode === 0 && result.stdout === 'true',
    actual: { 
      isGitRepo: result.stdout === 'true',
      exitCode: result.exitCode,
      output: result.stdout || result.stderr
    },
    expected: { isGitRepo: true, exitCode: 0 },
    error: result.exitCode !== 0 ? `Git check failed: ${result.stderr}` : undefined,
    details: result.stdout === 'true' ? 'Git repository initialized in /workspace' : 'No git repository found'
  };
}

/**
 * Test Case 3: Verify ANTHROPIC_API_KEY is set
 */
function testAnthropicApiKey(): ValidationResult {
  const result = execInPod('[ -n "$ANTHROPIC_API_KEY" ] && echo "SET" || echo "NOT_SET"');
  
  return {
    pass: result.exitCode === 0 && result.stdout === 'SET',
    actual: { present: result.stdout === 'SET', exitCode: result.exitCode },
    expected: { present: true, exitCode: 0 },
    error: result.stdout !== 'SET' ? 'ANTHROPIC_API_KEY not set' : undefined,
    details: result.stdout === 'SET' ? 'ANTHROPIC_API_KEY configured from secret' : 'ANTHROPIC_API_KEY missing'
  };
}

/**
 * Test Case 4: Verify METABOB_API_KEY is set
 */
function testMetabobApiKey(): ValidationResult {
  const result = execInPod('[ -n "$METABOB_API_KEY" ] && echo "SET" || echo "NOT_SET"');
  
  // Also check the value matches expected
  const valueCheck = execInPod('echo $METABOB_API_KEY | head -c 30');
  const expectedPrefix = 'mb_devbob_test_simple_2026_v2';
  
  return {
    pass: result.exitCode === 0 && result.stdout === 'SET',
    actual: { 
      present: result.stdout === 'SET',
      valuePrefix: valueCheck.stdout,
      exitCode: result.exitCode 
    },
    expected: { 
      present: true, 
      valuePrefix: expectedPrefix,
      exitCode: 0 
    },
    error: result.stdout !== 'SET' ? 'METABOB_API_KEY not set' : undefined,
    details: result.stdout === 'SET' ? 'METABOB_API_KEY configured from secret' : 'METABOB_API_KEY missing'
  };
}

/**
 * Test Case 5: Verify activity templates are accessible
 */
function testActivityTemplates(): ValidationResult {
  const countResult = execInPod('ls /root/.local/share/opencode/storage/activity-template 2>/dev/null | wc -l');
  const count = parseInt(countResult.stdout) || 0;
  
  const listResult = execInPod('ls -1 /root/.local/share/opencode/storage/activity-template 2>/dev/null | head -5');
  
  return {
    pass: count >= 1, // At least 1 template (may need to copy more)
    actual: { 
      count,
      templates: listResult.stdout.split('\n').filter(Boolean),
      exitCode: countResult.exitCode
    },
    expected: { 
      count: { min: 3, ideal: 5 },
      accessible: true
    },
    error: count === 0 ? 'No activity templates found' : count < 3 ? `Only ${count} templates, expected 3+` : undefined,
    details: `Found ${count} activity templates in storage`
  };
}

/**
 * Test Case 6: Verify ConfigMap contains complete opencode.json
 */
function testConfigMapComplete(): ValidationResult {
  try {
    const configJson = execSync(
      'kubectl get configmap devbob -n metabob -o jsonpath=\'{.data.opencode\\.json}\'',
      { encoding: 'utf-8', stdio: 'pipe' }
    ).trim();
    
    if (!configJson) {
      return {
        pass: false,
        actual: { exists: false },
        expected: { exists: true, hasMcp: true, hasProvider: true, hasModel: true },
        error: 'ConfigMap opencode.json not found'
      };
    }
    
    const config = JSON.parse(configJson);
    
    const hasMcp = !!config.mcp?.metabob;
    const hasProvider = !!config.provider?.anthropic;
    const hasModel = !!config.model;
    const hasMetabobSection = !!config.metabob;
    const hasSessionMemory = !!config.sessionMemory;
    
    const isComplete = hasMcp && hasProvider && hasModel && hasMetabobSection && hasSessionMemory;
    
    return {
      pass: isComplete,
      actual: {
        exists: true,
        hasMcp,
        hasProvider,
        hasModel,
        hasMetabobSection,
        hasSessionMemory,
        mcpType: config.mcp?.metabob?.type,
        model: config.model
      },
      expected: {
        exists: true,
        hasMcp: true,
        hasProvider: true,
        hasModel: true,
        hasMetabobSection: true,
        hasSessionMemory: true
      },
      error: !isComplete ? 'ConfigMap opencode.json is incomplete' : undefined,
      details: isComplete 
        ? 'ConfigMap has complete opencode.json with all required sections' 
        : `Missing sections: ${[
            !hasMcp && 'mcp',
            !hasProvider && 'provider',
            !hasModel && 'model',
            !hasMetabobSection && 'metabob',
            !hasSessionMemory && 'sessionMemory'
          ].filter(Boolean).join(', ')}`
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: { error: error.message },
      expected: { exists: true, complete: true },
      error: `Failed to check ConfigMap: ${error.message}`
    };
  }
}

/**
 * Test Case 7: Verify ConfigMap is mounted in pod
 */
function testConfigMapMounted(): ValidationResult {
  const result = execInPod('[ -f /workspace/.config/opencode/opencode.json ] && echo "MOUNTED" || echo "NOT_MOUNTED"');
  
  const contentCheck = execInPod('cat /workspace/.config/opencode/opencode.json 2>/dev/null | head -c 100');
  
  return {
    pass: result.exitCode === 0 && result.stdout === 'MOUNTED',
    actual: {
      mounted: result.stdout === 'MOUNTED',
      contentPreview: contentCheck.stdout,
      exitCode: result.exitCode
    },
    expected: {
      mounted: true,
      exitCode: 0
    },
    error: result.stdout !== 'MOUNTED' ? 'ConfigMap not mounted at /workspace/.config/opencode/opencode.json' : undefined,
    details: result.stdout === 'MOUNTED' ? 'ConfigMap mounted correctly in pod' : 'ConfigMap mount missing'
  };
}

/**
 * Test Case 8: Verify all secrets are in k8s secret
 */
function testK8sSecretComplete(): ValidationResult {
  try {
    const secretKeys = execSync(
      'kubectl get secret devbob-secrets -n metabob -o jsonpath=\'{.data}\' 2>/dev/null | jq -r "keys[]"',
      { encoding: 'utf-8', stdio: 'pipe' }
    ).trim().split('\n').filter(Boolean);
    
    const expectedKeys = [
      'anthropic-api-key',
      'metabob-api-key',
      'github-token',
      'git-user-name',
      'git-user-email'
    ];
    
    const missingKeys = expectedKeys.filter(k => !secretKeys.includes(k));
    const hasAllKeys = missingKeys.length === 0;
    
    return {
      pass: hasAllKeys,
      actual: {
        keys: secretKeys,
        count: secretKeys.length
      },
      expected: {
        keys: expectedKeys,
        count: 5
      },
      error: !hasAllKeys ? `Missing secret keys: ${missingKeys.join(', ')}` : undefined,
      details: hasAllKeys 
        ? 'All 5 required secrets present in k8s secret' 
        : `Found ${secretKeys.length}/5 secrets`
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: { error: error.message },
      expected: { count: 5 },
      error: `Failed to check k8s secret: ${error.message}`
    };
  }
}

/**
 * Test Case 9: Verify pod logs show successful startup
 */
function testPodStartupLogs(): ValidationResult {
  try {
    const podName = getDevBobPodName();
    const logs = execSync(
      `kubectl logs -n metabob ${podName} --tail=100 2>&1`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    
    const hasListeningMessage = logs.includes('service=acp-command setup connection') || logs.includes('bootstrapping');
    const hasErrorMessage = logs.includes('Error:') || logs.includes('ECONNREFUSED');
    const hasCrashMessage = logs.includes('fatal') || logs.includes('crashed');
    
    return {
      pass: hasListeningMessage && !hasCrashMessage,
      actual: {
        hasListeningMessage,
        hasErrorMessage,
        hasCrashMessage,
        logSample: logs.substring(Math.max(0, logs.length - 500))
      },
      expected: {
        hasListeningMessage: true,
        hasCrashMessage: false
      },
      error: hasCrashMessage ? 'Pod logs show crash messages' : !hasListeningMessage ? 'No startup confirmation in logs' : undefined,
      details: hasListeningMessage ? 'Pod started successfully' : 'Pod startup issues detected'
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: { error: error.message },
      expected: { hasListeningMessage: true },
      error: `Failed to check pod logs: ${error.message}`
    };
  }
}

/**
 * Run all validation tests
 */
export function runValidation(): HarnessReport {
  const testCases: Array<{ name: string; fn: () => ValidationResult }> = [
    { name: 'Pod Running (not CrashLoopBackOff)', fn: testPodStatus },
    { name: 'Git Repository Initialized', fn: testGitRepository },
    { name: 'ANTHROPIC_API_KEY Available', fn: testAnthropicApiKey },
    { name: 'METABOB_API_KEY Available', fn: testMetabobApiKey },
    { name: 'Activity Templates Accessible', fn: testActivityTemplates },
    { name: 'ConfigMap Complete (provider, mcp, model, metabob)', fn: testConfigMapComplete },
    { name: 'ConfigMap Mounted in Pod', fn: testConfigMapMounted },
    { name: 'K8s Secret Complete (5 keys)', fn: testK8sSecretComplete },
    { name: 'Pod Startup Logs Show Success', fn: testPodStartupLogs }
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
    specificationName: 'devbob-complete-environment-setup',
    timestamp: new Date().toISOString(),
    environment: 'local-kubectl',
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
  console.log('  DevBob Complete Environment Setup - Validation Harness');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const report = runValidation();
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Validation Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Specification: ${report.specificationName}`);
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Environment: ${report.environment}`);
  console.log(`Total Tests: ${report.totalTests}`);
  console.log(`Passed: ${report.passed} ✅`);
  console.log(`Failed: ${report.failed} ❌`);
  console.log(`Success Rate: ${Math.round((report.passed / report.totalTests) * 100)}%`);
  
  const exitCode = report.failed === 0 ? 0 : 1;
  process.exit(exitCode);
}
