#!/usr/bin/env node
/**
 * Cochange MCP Integration Test - Verified Approach
 * 
 * Tests the ACTUAL production integration path:
 * MetabobCLI.suggestRelatedChanges() → callMCPTool() → MCP.clients()["metabob"]
 * 
 * This matches how OpenCode actually calls Metabob tools in production.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = __dirname;

// Test configuration
const TEST_CONFIG = {
  mcpServerPort: 8002,
  timeout: 30000,
  testFiles: [
    'repos/metabob-opencode/packages/opencode/src/util/metabob.ts',
    'repos/metabob-opencode/packages/opencode/src/session/system.ts'
  ]
};

/**
 * Color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70) + '\n');
}

function logStep(step, message) {
  log(`[${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

/**
 * Check if MCP server is running
 */
async function checkMCPServer() {
  logStep('1/5', 'Checking MCP server availability...');
  
  try {
    const response = await fetch(`http://localhost:${TEST_CONFIG.mcpServerPort}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      logSuccess(`MCP server running on port ${TEST_CONFIG.mcpServerPort}`);
      return true;
    } else {
      logWarning(`MCP server returned status ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`MCP server not reachable: ${error.message}`);
    logWarning('Start MCP server with: cd repos/metabob-cli && python -m metabob_cli.mcp.server');
    return false;
  }
}

/**
 * Test the production integration path using OpenCode's own code
 * 
 * This creates a minimal TypeScript test that imports the actual
 * MetabobCLI.suggestRelatedChanges() function from OpenCode
 */
async function testProductionIntegration() {
  logStep('2/5', 'Testing production MetabobCLI.suggestRelatedChanges() integration...');
  
  // Create a test script that uses the actual OpenCode code
  const testScript = `
import { MetabobCLI } from './repos/metabob-opencode/packages/opencode/src/util/metabob.ts';

async function testCochange() {
  try {
    console.log('Testing MetabobCLI.suggestRelatedChanges()...');
    
    const testFiles = [
      'repos/metabob-opencode/packages/opencode/src/util/metabob.ts'
    ];
    
    const result = await MetabobCLI.suggestRelatedChanges(testFiles, {
      top_k: 5
    });
    
    console.log('SUCCESS:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('FAILED:', error.message);
    process.exit(1);
  }
}

testCochange();
  `.trim();
  
  // Write test script
  const fs = await import('fs');
  const testPath = join(PROJECT_ROOT, 'test_cochange_production.mjs');
  await fs.promises.writeFile(testPath, testScript);
  
  return new Promise((resolve) => {
    logStep('3/5', 'Executing test via Bun (OpenCode runtime)...');
    
    const proc = spawn('bun', [testPath], {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        logSuccess('Production integration test PASSED');
        console.log('\nResult:');
        console.log(stdout);
        resolve({ success: true, result: stdout });
      } else {
        logError('Production integration test FAILED');
        console.log('\nStdout:', stdout);
        console.log('Stderr:', stderr);
        resolve({ success: false, error: stderr });
      }
      
      // Cleanup
      fs.promises.unlink(testPath).catch(() => {});
    });
    
    setTimeout(() => {
      proc.kill();
      logError('Test timed out after 30s');
      resolve({ success: false, error: 'Timeout' });
      fs.promises.unlink(testPath).catch(() => {});
    }, TEST_CONFIG.timeout);
  });
}

/**
 * Verify integration points in codebase
 */
async function verifyIntegrationPoints() {
  logStep('4/5', 'Verifying integration points in codebase...');
  
  const fs = await import('fs');
  const integrationPoints = [
    {
      name: 'Activity Tool',
      file: 'repos/metabob-opencode/packages/opencode/src/tool/activity.ts',
      pattern: 'MetabobCLI.suggestRelatedChanges'
    },
    {
      name: 'System Context',
      file: 'repos/metabob-opencode/packages/opencode/src/session/system.ts',
      pattern: 'suggestRelatedChanges'
    },
    {
      name: 'Template Feedback',
      file: 'repos/metabob-opencode/packages/opencode/src/session/distributed-template-feedback.ts',
      pattern: 'suggestRelatedChanges'
    },
    {
      name: 'MCP Client',
      file: 'repos/metabob-opencode/packages/opencode/src/mcp/index.ts',
      pattern: 'callTool'
    },
    {
      name: 'Metabob CLI Wrapper',
      file: 'repos/metabob-opencode/packages/opencode/src/util/metabob.ts',
      pattern: 'export async function suggestRelatedChanges'
    }
  ];
  
  let allFound = true;
  
  for (const point of integrationPoints) {
    const fullPath = join(PROJECT_ROOT, point.file);
    
    try {
      const content = await fs.promises.readFile(fullPath, 'utf-8');
      
      if (content.includes(point.pattern)) {
        logSuccess(`${point.name}: Found at ${point.file}`);
      } else {
        logWarning(`${point.name}: Pattern not found in ${point.file}`);
        allFound = false;
      }
    } catch (error) {
      logError(`${point.name}: File not found - ${point.file}`);
      allFound = false;
    }
  }
  
  return allFound;
}

/**
 * Generate test report
 */
function generateReport(results) {
  logStep('5/5', 'Generating test report...');
  
  logSection('COCHANGE MCP INTEGRATION TEST REPORT');
  
  console.log('Test Configuration:');
  console.log(`  MCP Server Port: ${TEST_CONFIG.mcpServerPort}`);
  console.log(`  Timeout: ${TEST_CONFIG.timeout}ms`);
  console.log(`  Test Files: ${TEST_CONFIG.testFiles.length}`);
  console.log('');
  
  console.log('Test Results:');
  console.log(`  MCP Server: ${results.mcpServer ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Production Integration: ${results.productionTest ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Integration Points: ${results.integrationPoints ? '✓ PASS' : '✗ FAIL'}`);
  console.log('');
  
  const totalTests = 3;
  const passedTests = [
    results.mcpServer,
    results.productionTest,
    results.integrationPoints
  ].filter(Boolean).length;
  
  console.log(`Overall: ${passedTests}/${totalTests} tests passed`);
  console.log('');
  
  if (passedTests === totalTests) {
    logSuccess('ALL TESTS PASSED ✓');
    console.log('');
    console.log('The cochange embeddings integration is fully verified and working.');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run end-to-end test with real activity execution');
    console.log('  2. Measure performance (<250ms target)');
    console.log('  3. Collect baseline cochange accuracy metrics');
    return true;
  } else {
    logError('SOME TESTS FAILED ✗');
    console.log('');
    console.log('Review the errors above and fix before proceeding.');
    return false;
  }
}

/**
 * Main test execution
 */
async function main() {
  logSection('COCHANGE MCP INTEGRATION TEST');
  
  console.log('This test verifies the production integration of cochange embeddings');
  console.log('using the ACTUAL OpenCode codebase (not mock implementations).');
  console.log('');
  
  const results = {
    mcpServer: false,
    productionTest: false,
    integrationPoints: false
  };
  
  try {
    // Test 1: MCP Server
    results.mcpServer = await checkMCPServer();
    
    if (!results.mcpServer) {
      logWarning('Skipping production test - MCP server not available');
      logWarning('Other tests will still run (codebase verification)');
      console.log('');
    }
    
    // Test 2: Production Integration (only if MCP server is running)
    if (results.mcpServer) {
      const testResult = await testProductionIntegration();
      results.productionTest = testResult.success;
    }
    
    // Test 3: Integration Points
    results.integrationPoints = await verifyIntegrationPoints();
    
    // Generate report
    const success = generateReport(results);
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    logError(`Test execution failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
main();
