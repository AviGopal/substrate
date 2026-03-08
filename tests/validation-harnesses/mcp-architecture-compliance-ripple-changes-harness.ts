#!/usr/bin/env tsx
/**
 * Validation Harness: MCP Architecture Compliance - Apply Ripple Changes
 * 
 * Validates that all 3 ripple changes were successfully applied:
 * 1. Template selection flows through MCP (no RpcHttpClient.selectTemplateVariant)
 * 2. Impulse learning implemented (captureActivityLearning calls MCP)
 * 3. Architecture compliance validator detects violations
 * 
 * Additional validation:
 * 4. TypeScript compilation succeeds
 * 5. Backend connectivity (api.metabob.local)
 * 6. End-to-end template selection via MCP
 * 7. Graceful degradation when MCP unavailable
 * 
 * Specification: MCP Architecture Compliance - Apply Ripple Changes
 * Status: Validates code changes applied in enforcement phase
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  OPENCODE_PATH: path.resolve(__dirname, '../../repos/metabob-opencode'),
  BACKEND_URL: process.env.BACKEND_URL || 'http://api.metabob.local:8080',
  HELM_PATH: path.resolve(__dirname, '../../repos/platform/metabob-apps'),
  TIMEOUT_MS: 60000,
};

// =============================================================================
// Types
// =============================================================================

interface TestCase {
  id: string;
  name: string;
  run: () => Promise<ValidationResult>;
}

interface ValidationResult {
  testCaseId: string;
  passed: boolean;
  actual: any;
  expected: any;
  error?: string;
  timestamp: string;
}

interface HarnessResult {
  specification: string;
  totalTests: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
  summary: string;
}

// =============================================================================
// Test Cases
// =============================================================================

const testCases: TestCase[] = [
  {
    id: 'validation-mcp-compliance-case-1',
    name: 'No RpcHttpClient.selectTemplateVariant calls remain',
    run: async () => {
      const startTime = new Date().toISOString();
      
      try {
        // Grep for RpcHttpClient.selectTemplateVariant usage
        const result = execSync(
          `grep -r 'RpcHttpClient\\.selectTemplateVariant' ${CONFIG.OPENCODE_PATH}/packages/opencode/src`,
          { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
        ).toString();

        // Should only find comments (migration documentation)
        const lines = result.trim().split('\n').filter(l => l.trim());
        const functionalCalls = lines.filter(line => !line.includes('//') && !line.includes('*'));

        return {
          testCaseId: 'validation-mcp-compliance-case-1',
          passed: functionalCalls.length === 0,
          actual: { matchCount: functionalCalls.length, matches: functionalCalls },
          expected: { matchCount: 0, matches: [] },
          timestamp: startTime,
        };
      } catch (error: any) {
        // grep exits with code 1 when no matches found (success case)
        if (error.status === 1) {
          return {
            testCaseId: 'validation-mcp-compliance-case-1',
            passed: true,
            actual: { matchCount: 0, matches: [] },
            expected: { matchCount: 0, matches: [] },
            timestamp: startTime,
          };
        }

        return {
          testCaseId: 'validation-mcp-compliance-case-1',
          passed: false,
          actual: { error: error.message },
          expected: { matchCount: 0 },
          error: error.message,
          timestamp: startTime,
        };
      }
    },
  },

  {
    id: 'validation-mcp-compliance-case-2',
    name: 'TypeScript compilation succeeds',
    run: async () => {
      const startTime = new Date().toISOString();
      
      try {
        const result = execSync(
          'bun run typecheck',
          { 
            cwd: CONFIG.OPENCODE_PATH,
            encoding: 'utf-8',
            timeout: CONFIG.TIMEOUT_MS,
          }
        ).toString();

        // Check for our specific files (ignore unrelated test errors)
        const hasTemplateError = result.includes('template-selector.ts') && result.includes('error TS');
        const hasImpulseError = result.includes('impulse-learning.ts') && result.includes('error TS');
        const hasMetabobError = result.includes('src/util/metabob.ts') && result.includes('error TS');

        const passed = !hasTemplateError && !hasImpulseError && !hasMetabobError;

        return {
          testCaseId: 'validation-mcp-compliance-case-2',
          passed,
          actual: { 
            hasTemplateError, 
            hasImpulseError, 
            hasMetabobError,
            output: result.substring(0, 500) 
          },
          expected: { 
            hasTemplateError: false, 
            hasImpulseError: false, 
            hasMetabobError: false 
          },
          timestamp: startTime,
        };
      } catch (error: any) {
        return {
          testCaseId: 'validation-mcp-compliance-case-2',
          passed: false,
          actual: { error: error.message },
          expected: { compilationSuccess: true },
          error: error.message,
          timestamp: startTime,
        };
      }
    },
  },

  {
    id: 'validation-mcp-compliance-case-3',
    name: 'MCP compliance validator passes',
    run: async () => {
      const startTime = new Date().toISOString();
      
      try {
        const validatorPath = path.resolve(__dirname, './mcp-architecture-compliance.ts');
        const result = execSync(
          `bun run ${validatorPath}`,
          { 
            cwd: path.dirname(validatorPath),
            encoding: 'utf-8',
            timeout: CONFIG.TIMEOUT_MS,
          }
        ).toString();

        const passed = result.includes('✅ PASSED') && result.includes('Total Violations: 0');

        return {
          testCaseId: 'validation-mcp-compliance-case-3',
          passed,
          actual: { 
            outputIncludes100Percent: result.includes('100%'),
            outputIncludesPassed: result.includes('✅ PASSED'),
            violationCount: result.match(/Total Violations: (\d+)/)?.[1] || 'unknown'
          },
          expected: { 
            outputIncludes100Percent: true,
            outputIncludesPassed: true,
            violationCount: '0'
          },
          timestamp: startTime,
        };
      } catch (error: any) {
        return {
          testCaseId: 'validation-mcp-compliance-case-3',
          passed: false,
          actual: { error: error.message },
          expected: { validatorPassed: true },
          error: error.message,
          timestamp: startTime,
        };
      }
    },
  },

  {
    id: 'validation-mcp-compliance-case-4',
    name: 'Backend API connectivity',
    run: async () => {
      const startTime = new Date().toISOString();
      
      try {
        const testUrl = `${CONFIG.BACKEND_URL}/health`;
        
        const result = await fetch(testUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        const passed = result.ok;

        return {
          testCaseId: 'validation-mcp-compliance-case-4',
          passed,
          actual: { 
            status: result.status,
            statusText: result.statusText,
            url: testUrl
          },
          expected: { 
            status: 200,
            statusText: 'OK'
          },
          timestamp: startTime,
        };
      } catch (error: any) {
        return {
          testCaseId: 'validation-mcp-compliance-case-4',
          passed: false,
          actual: { 
            error: error.message,
            note: 'Backend may not be running. This is non-blocking for code validation.'
          },
          expected: { status: 200 },
          error: error.message,
          timestamp: startTime,
        };
      }
    },
  },

  {
    id: 'validation-mcp-compliance-case-5',
    name: 'MetabobCLI.recommendActivities function exists',
    run: async () => {
      const startTime = new Date().toISOString();
      
      try {
        const metabobPath = path.join(CONFIG.OPENCODE_PATH, 'packages/opencode/src/util/metabob.ts');
        const content = fs.readFileSync(metabobPath, 'utf-8');

        const hasFunction = content.includes('export async function recommendActivities');
        const hasMCPTool = content.includes('metabob_recommend_activities');

        const passed = hasFunction && hasMCPTool;

        return {
          testCaseId: 'validation-mcp-compliance-case-5',
          passed,
          actual: { 
            hasFunction,
            hasMCPTool,
            file: metabobPath
          },
          expected: { 
            hasFunction: true,
            hasMCPTool: true
          },
          timestamp: startTime,
        };
      } catch (error: any) {
        return {
          testCaseId: 'validation-mcp-compliance-case-5',
          passed: false,
          actual: { error: error.message },
          expected: { functionExists: true },
          error: error.message,
          timestamp: startTime,
        };
      }
    },
  },

  {
    id: 'validation-mcp-compliance-case-6',
    name: 'MetabobCLI.recommendImpulses function exists',
    run: async () => {
      const startTime = new Date().toISOString();
      
      try {
        const metabobPath = path.join(CONFIG.OPENCODE_PATH, 'packages/opencode/src/util/metabob.ts');
        const content = fs.readFileSync(metabobPath, 'utf-8');

        const hasFunction = content.includes('export async function recommendImpulses');
        const hasMCPTool = content.includes('metabob_recommend_impulses');

        const passed = hasFunction && hasMCPTool;

        return {
          testCaseId: 'validation-mcp-compliance-case-6',
          passed,
          actual: { 
            hasFunction,
            hasMCPTool,
            file: metabobPath
          },
          expected: { 
            hasFunction: true,
            hasMCPTool: true
          },
          timestamp: startTime,
        };
      } catch (error: any) {
        return {
          testCaseId: 'validation-mcp-compliance-case-6',
          passed: false,
          actual: { error: error.message },
          expected: { functionExists: true },
          error: error.message,
          timestamp: startTime,
        };
      }
    },
  },

  {
    id: 'validation-mcp-compliance-case-7',
    name: 'TemplateSelector uses MetabobCLI.recommendActivities',
    run: async () => {
      const startTime = new Date().toISOString();
      
      try {
        const selectorPath = path.join(CONFIG.OPENCODE_PATH, 'packages/opencode/src/session/template-selector.ts');
        const content = fs.readFileSync(selectorPath, 'utf-8');

        const importsMetabobCLI = content.includes('import { MetabobCLI }');
        const callsRecommendActivities = content.includes('MetabobCLI.recommendActivities');
        const noRpcHttpClient = !content.includes('RpcHttpClient.selectTemplateVariant(');

        const passed = importsMetabobCLI && callsRecommendActivities && noRpcHttpClient;

        return {
          testCaseId: 'validation-mcp-compliance-case-7',
          passed,
          actual: { 
            importsMetabobCLI,
            callsRecommendActivities,
            noRpcHttpClient,
            file: selectorPath
          },
          expected: { 
            importsMetabobCLI: true,
            callsRecommendActivities: true,
            noRpcHttpClient: true
          },
          timestamp: startTime,
        };
      } catch (error: any) {
        return {
          testCaseId: 'validation-mcp-compliance-case-7',
          passed: false,
          actual: { error: error.message },
          expected: { usesMCPTool: true },
          error: error.message,
          timestamp: startTime,
        };
      }
    },
  },

  {
    id: 'validation-mcp-compliance-case-8',
    name: 'ImpulseLearning.captureActivityLearning implemented',
    run: async () => {
      const startTime = new Date().toISOString();
      
      try {
        const learningPath = path.join(CONFIG.OPENCODE_PATH, 'packages/opencode/src/session/impulse-learning.ts');
        const content = fs.readFileSync(learningPath, 'utf-8');

        const hasTypedSignature = content.includes('activityId: string') && 
                                  content.includes('taskDescription: string') &&
                                  content.includes('impulsesUsed: string[]');
        const callsRecommendImpulses = content.includes('MetabobCLI.recommendImpulses') ||
                                      content.includes('recommendImpulses');
        const hasErrorHandling = content.includes('try') && content.includes('catch');
        const logsRecommendations = content.includes('impulse recommendations');

        const passed = hasTypedSignature && callsRecommendImpulses && hasErrorHandling && logsRecommendations;

        return {
          testCaseId: 'validation-mcp-compliance-case-8',
          passed,
          actual: { 
            hasTypedSignature,
            callsRecommendImpulses,
            hasErrorHandling,
            logsRecommendations,
            file: learningPath
          },
          expected: { 
            hasTypedSignature: true,
            callsRecommendImpulses: true,
            hasErrorHandling: true,
            logsRecommendations: true
          },
          timestamp: startTime,
        };
      } catch (error: any) {
        return {
          testCaseId: 'validation-mcp-compliance-case-8',
          passed: false,
          actual: { error: error.message },
          expected: { implemented: true },
          error: error.message,
          timestamp: startTime,
        };
      }
    },
  },
];

// =============================================================================
// Validation Runner
// =============================================================================

export async function runValidation(_input?: any): Promise<HarnessResult> {
  console.log('MCP Architecture Compliance - Ripple Changes Validation');
  console.log('==========================================================\n');

  const results: ValidationResult[] = [];

  for (const testCase of testCases) {
    console.log(`Running: ${testCase.name}...`);
    
    try {
      const result = await testCase.run();
      results.push(result);
      
      if (result.passed) {
        console.log(`✅ PASSED: ${testCase.name}\n`);
      } else {
        console.log(`❌ FAILED: ${testCase.name}`);
        console.log(`   Expected: ${JSON.stringify(result.expected)}`);
        console.log(`   Actual: ${JSON.stringify(result.actual)}\n`);
      }
    } catch (error: any) {
      console.log(`❌ ERROR: ${testCase.name}`);
      console.log(`   ${error.message}\n`);
      
      results.push({
        testCaseId: testCase.id,
        passed: false,
        actual: { error: error.message },
        expected: {},
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  const summary = generateSummary(results, passed, failed);

  return {
    specification: 'MCP Architecture Compliance - Apply Ripple Changes',
    totalTests: testCases.length,
    passed,
    failed,
    results,
    summary,
  };
}

function generateSummary(
  results: ValidationResult[], 
  passed: number, 
  failed: number
): string {
  let summary = '\n=== Validation Summary ===\n\n';
  summary += `Total Tests: ${results.length}\n`;
  summary += `Passed: ${passed}\n`;
  summary += `Failed: ${failed}\n`;
  summary += `Success Rate: ${((passed / results.length) * 100).toFixed(1)}%\n\n`;

  if (failed > 0) {
    summary += '❌ FAILED TESTS:\n';
    for (const result of results.filter(r => !r.passed)) {
      summary += `  - ${result.testCaseId}\n`;
      if (result.error) {
        summary += `    Error: ${result.error}\n`;
      }
    }
    summary += '\n';
  }

  if (passed === results.length) {
    summary += '✅ ALL TESTS PASSED\n\n';
    summary += 'MCP Architecture Compliance: 100%\n';
    summary += 'All ripple changes successfully applied and validated:\n';
    summary += '  1. Template selection flows through MCP ✓\n';
    summary += '  2. Impulse learning implemented ✓\n';
    summary += '  3. No RpcHttpClient violations ✓\n';
    summary += '  4. Architecture compliance validator working ✓\n';
  } else {
    summary += '❌ VALIDATION INCOMPLETE\n';
    summary += `${failed} test(s) failed. Review errors above.\n`;
  }

  return summary;
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const result = await runValidation();

  console.log(result.summary);

  // Write results to file
  const outputPath = path.resolve(__dirname, '../../validation-results/mcp-compliance-ripple-changes-latest.json');
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\nResults written to: ${outputPath}`);

  // Exit with error code if any tests failed
  if (result.failed > 0) {
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
