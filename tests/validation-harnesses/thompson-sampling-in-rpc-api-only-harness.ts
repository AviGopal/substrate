/**
 * Validation Harness: thompson-sampling-in-rpc-api-only
 * 
 * Specification: Thompson Sampling (Beta distribution variant selection) must ONLY exist in metabob-rpc-api.
 * metabob-opencode must call rpc-api endpoint for template selection.
 * 
 * Validation Strategy:
 * 1. Search for Thompson Sampling code in metabob-opencode (must be 0 matches)
 * 2. Verify RPC API has the selection endpoint
 * 3. Verify opencode calls RPC API for selection
 * 4. Verify no Beta distribution sampling in opencode
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface ValidationResult {
  pass: boolean;
  testCase: string;
  actual: any;
  expected: any;
  reason?: string;
}

export interface ValidationSummary {
  overallPass: boolean;
  totalTests: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
}

/**
 * Search for forbidden patterns in metabob-opencode
 */
function searchForForbiddenPatterns(baseDir: string): ValidationResult[] {
  const results: ValidationResult[] = [];
  const opencodeDir = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src');

  if (!fs.existsSync(opencodeDir)) {
    return [{
      pass: false,
      testCase: 'Directory Existence',
      actual: 'Directory not found',
      expected: 'Directory exists',
      reason: `metabob-opencode directory not found at: ${opencodeDir}`
    }];
  }

  // Test 1: No "thompson" references (except in comments)
  try {
    const thompsonCmd = `grep -r "thompson" ${opencodeDir} --include="*.ts" --include="*.js" | grep -v "// .*thompson" | grep -v "/\\* .*thompson" | grep -v "\\* REMOVED" || true`;
    const thompsonMatches = execSync(thompsonCmd, { encoding: 'utf8' }).trim();
    
    results.push({
      pass: thompsonMatches.length === 0,
      testCase: 'No Thompson Sampling references in opencode',
      actual: thompsonMatches.length === 0 ? 'No matches found' : `Found matches:\n${thompsonMatches}`,
      expected: 'No matches (or only in comments)',
      reason: thompsonMatches.length > 0 ? 'Thompson Sampling code should not exist in opencode' : undefined
    });
  } catch (error) {
    results.push({
      pass: false,
      testCase: 'No Thompson Sampling references in opencode',
      actual: `Error: ${error}`,
      expected: 'Successful search with 0 matches'
    });
  }

  // Test 2: No "beta" distribution references (except in comments)
  try {
    const betaCmd = `grep -r "beta.*distribution\\|betavariate\\|Beta(" ${opencodeDir} --include="*.ts" --include="*.js" | grep -v "// .*beta" | grep -v "/\\* .*beta" | grep -v "\\* REMOVED" || true`;
    const betaMatches = execSync(betaCmd, { encoding: 'utf8' }).trim();
    
    results.push({
      pass: betaMatches.length === 0,
      testCase: 'No Beta distribution sampling in opencode',
      actual: betaMatches.length === 0 ? 'No matches found' : `Found matches:\n${betaMatches}`,
      expected: 'No matches (or only in comments)',
      reason: betaMatches.length > 0 ? 'Beta distribution sampling should not exist in opencode' : undefined
    });
  } catch (error) {
    results.push({
      pass: false,
      testCase: 'No Beta distribution sampling in opencode',
      actual: `Error: ${error}`,
      expected: 'Successful search with 0 matches'
    });
  }

  // Test 3: Verify removal comments exist (proves it was removed intentionally)
  try {
    const removalCommentsCmd = `grep -n "REMOVED.*betaSample\\|REMOVED.*performThompsonSampling" ${opencodeDir}/session/template-selector.ts || true`;
    const removalComments = execSync(removalCommentsCmd, { encoding: 'utf8' }).trim();
    
    results.push({
      pass: removalComments.length > 0,
      testCase: 'Removal comments exist for Thompson Sampling functions',
      actual: removalComments.length > 0 ? `Found removal comments:\n${removalComments}` : 'No removal comments found',
      expected: 'Comments documenting removal of betaSample() and performThompsonSampling()',
      reason: removalComments.length === 0 ? 'Should have comments documenting intentional removal' : undefined
    });
  } catch (error) {
    results.push({
      pass: false,
      testCase: 'Removal comments exist for Thompson Sampling functions',
      actual: `Error: ${error}`,
      expected: 'Successful search for removal comments'
    });
  }

  return results;
}

/**
 * Verify RPC API has the required endpoint
 */
function verifyRpcApiEndpoint(baseDir: string): ValidationResult[] {
  const results: ValidationResult[] = [];
  const rpcApiDir = path.join(baseDir, 'repos/metabob-rpc-api/server');

  if (!fs.existsSync(rpcApiDir)) {
    return [{
      pass: false,
      testCase: 'RPC API Directory Existence',
      actual: 'Directory not found',
      expected: 'Directory exists',
      reason: `metabob-rpc-api directory not found at: ${rpcApiDir}`
    }];
  }

  // Test 4: Verify select_variant endpoint exists
  try {
    const endpointCmd = `grep -n "POST.*templates.*select\\|select_variant" ${rpcApiDir}/routes/activity.py || true`;
    const endpointMatches = execSync(endpointCmd, { encoding: 'utf8' }).trim();
    
    results.push({
      pass: endpointMatches.length > 0,
      testCase: 'RPC API has template selection endpoint',
      actual: endpointMatches.length > 0 ? `Found endpoint:\n${endpointMatches}` : 'Endpoint not found',
      expected: 'POST endpoint for template selection exists',
      reason: endpointMatches.length === 0 ? 'RPC API must have selection endpoint' : undefined
    });
  } catch (error) {
    results.push({
      pass: false,
      testCase: 'RPC API has template selection endpoint',
      actual: `Error: ${error}`,
      expected: 'Successful search for endpoint'
    });
  }

  // Test 5: Verify sample_beta function exists in rpc-api
  try {
    const sampleBetaCmd = `grep -n "def sample_beta" ${rpcApiDir}/actions/activity.py || true`;
    const sampleBetaMatches = execSync(sampleBetaCmd, { encoding: 'utf8' }).trim();
    
    results.push({
      pass: sampleBetaMatches.length > 0,
      testCase: 'RPC API has sample_beta() function',
      actual: sampleBetaMatches.length > 0 ? `Found function:\n${sampleBetaMatches}` : 'Function not found',
      expected: 'sample_beta() function exists in rpc-api',
      reason: sampleBetaMatches.length === 0 ? 'Thompson Sampling must exist in RPC API' : undefined
    });
  } catch (error) {
    results.push({
      pass: false,
      testCase: 'RPC API has sample_beta() function',
      actual: `Error: ${error}`,
      expected: 'Successful search for sample_beta()'
    });
  }

  // Test 6: Verify select_variant_thompson_sampling exists
  try {
    const thompsonFuncCmd = `grep -n "def select_variant_thompson_sampling" ${rpcApiDir}/actions/activity.py || true`;
    const thompsonFuncMatches = execSync(thompsonFuncCmd, { encoding: 'utf8' }).trim();
    
    results.push({
      pass: thompsonFuncMatches.length > 0,
      testCase: 'RPC API has select_variant_thompson_sampling() function',
      actual: thompsonFuncMatches.length > 0 ? `Found function:\n${thompsonFuncMatches}` : 'Function not found',
      expected: 'select_variant_thompson_sampling() function exists in rpc-api',
      reason: thompsonFuncMatches.length === 0 ? 'Thompson Sampling algorithm must exist in RPC API' : undefined
    });
  } catch (error) {
    results.push({
      pass: false,
      testCase: 'RPC API has select_variant_thompson_sampling() function',
      actual: `Error: ${error}`,
      expected: 'Successful search for select_variant_thompson_sampling()'
    });
  }

  return results;
}

/**
 * Verify opencode calls RPC API for selection
 */
function verifyOpencodeCallsRpcApi(baseDir: string): ValidationResult[] {
  const results: ValidationResult[] = [];
  const opencodeDir = path.join(baseDir, 'repos/metabob-opencode/packages/opencode/src');

  // Test 7: Verify RpcHttpClient.selectTemplateVariant exists
  try {
    const rpcClientCmd = `grep -n "selectTemplateVariant" ${opencodeDir}/util/rpc-http-client.ts || true`;
    const rpcClientMatches = execSync(rpcClientCmd, { encoding: 'utf8' }).trim();
    
    results.push({
      pass: rpcClientMatches.length > 0,
      testCase: 'opencode has RpcHttpClient.selectTemplateVariant()',
      actual: rpcClientMatches.length > 0 ? `Found function:\n${rpcClientMatches}` : 'Function not found',
      expected: 'selectTemplateVariant() function exists in RpcHttpClient',
      reason: rpcClientMatches.length === 0 ? 'opencode must have RPC client function for selection' : undefined
    });
  } catch (error) {
    results.push({
      pass: false,
      testCase: 'opencode has RpcHttpClient.selectTemplateVariant()',
      actual: `Error: ${error}`,
      expected: 'Successful search for selectTemplateVariant()'
    });
  }

  // Test 8: Verify TemplateSelector calls RpcHttpClient
  try {
    const selectorCmd = `grep -n "RpcHttpClient.*selectTemplateVariant\\|rpcHttpClient.*selectTemplateVariant" ${opencodeDir}/session/template-selector.ts || true`;
    const selectorMatches = execSync(selectorCmd, { encoding: 'utf8' }).trim();
    
    results.push({
      pass: selectorMatches.length > 0,
      testCase: 'TemplateSelector calls RpcHttpClient.selectTemplateVariant()',
      actual: selectorMatches.length > 0 ? `Found call:\n${selectorMatches}` : 'Call not found',
      expected: 'TemplateSelector delegates to RpcHttpClient',
      reason: selectorMatches.length === 0 ? 'TemplateSelector must delegate selection to RPC API' : undefined
    });
  } catch (error) {
    results.push({
      pass: false,
      testCase: 'TemplateSelector calls RpcHttpClient.selectTemplateVariant()',
      actual: `Error: ${error}`,
      expected: 'Successful search for delegation call'
    });
  }

  // Test 9: Verify RPC API URL is read from environment
  try {
    const envCmd = `grep -n "METABOB_RPC_API_URL" ${opencodeDir}/util/rpc-http-client.ts || true`;
    const envMatches = execSync(envCmd, { encoding: 'utf8' }).trim();
    
    results.push({
      pass: envMatches.length > 0,
      testCase: 'RpcHttpClient reads METABOB_RPC_API_URL from environment',
      actual: envMatches.length > 0 ? `Found environment variable usage:\n${envMatches}` : 'Environment variable not found',
      expected: 'METABOB_RPC_API_URL environment variable is used',
      reason: envMatches.length === 0 ? 'RPC API URL must be configurable via environment' : undefined
    });
  } catch (error) {
    results.push({
      pass: false,
      testCase: 'RpcHttpClient reads METABOB_RPC_API_URL from environment',
      actual: `Error: ${error}`,
      expected: 'Successful search for environment variable'
    });
  }

  return results;
}

/**
 * Run all validation tests
 */
export function runValidation(baseDir: string = process.cwd()): ValidationSummary {
  const allResults: ValidationResult[] = [
    ...searchForForbiddenPatterns(baseDir),
    ...verifyRpcApiEndpoint(baseDir),
    ...verifyOpencodeCallsRpcApi(baseDir)
  ];

  const passed = allResults.filter(r => r.pass).length;
  const failed = allResults.filter(r => !r.pass).length;

  return {
    overallPass: failed === 0,
    totalTests: allResults.length,
    passed,
    failed,
    results: allResults
  };
}

/**
 * CLI entry point
 */
function main() {
  const baseDir = process.argv[2] || process.cwd();
  console.log(`Running validation for thompson-sampling-in-rpc-api-only specification...\n`);
  console.log(`Base directory: ${baseDir}\n`);

  const summary = runValidation(baseDir);

  console.log('=== VALIDATION RESULTS ===\n');
  summary.results.forEach((result, index) => {
    const status = result.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${status}: ${result.testCase}`);
    if (!result.pass) {
      console.log(`   Expected: ${result.expected}`);
      console.log(`   Actual: ${result.actual}`);
      if (result.reason) {
        console.log(`   Reason: ${result.reason}`);
      }
    }
    console.log();
  });

  console.log('=== SUMMARY ===');
  console.log(`Total Tests: ${summary.totalTests}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Overall: ${summary.overallPass ? '✅ PASS' : '❌ FAIL'}`);

  process.exit(summary.overallPass ? 0 : 1);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
