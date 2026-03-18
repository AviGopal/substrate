/**
 * External Activity System Validation Harness
 * 
 * This harness validates that OpenCode's activity system works by:
 * 1. Using ONLY compiled distribution (not dev code)
 * 2. Testing 3 scenarios via CLI:
 *    - Find and execute existing activity
 *    - Create new activity via goal-seeking
 *    - Verify NO direct tool calls in root session
 * 3. Analyzing logs for activity patterns
 * 4. Providing automated PASS/FAIL
 * 5. Meta-validating that all requirements were tested
 * 
 * This is a TRUE external validation - no code dependencies, only observable behavior.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface ValidationInput {
  scenario: 'existing-activity' | 'novel-goal' | 'no-direct-tools';
  command: string;
  args: string[];
  expectedPatterns: string[];
  forbiddenPatterns: string[];
  timeout: number;
}

export interface ValidationOutput {
  pass: boolean;
  actual: {
    exitCode: number;
    stdout: string;
    stderr: string;
    logs: string[];
    executionTime: number;
    patternsFound: string[];
    patternsMissing: string[];
    forbiddenPatternsFound: string[];
  };
  expected: {
    exitCode: number;
    requiredPatterns: string[];
    forbiddenPatterns: string[];
  };
  evidence: string[];
  errors: string[];
}

export interface ValidationResult {
  specificationName: string;
  timestamp: number;
  testCases: {
    id: string;
    input: ValidationInput;
    output: ValidationOutput;
    passed: boolean;
  }[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    overallPass: boolean;
  };
  metaValidation: {
    testedCompiledDistribution: boolean;
    testedExistingActivity: boolean;
    testedGoalSeeking: boolean;
    testedNoDirectTools: boolean;
    testedLogAnalysis: boolean;
    allRequirementsTested: boolean;
  };
}

// ============================================================================
// Configuration
// ============================================================================

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const OPENCODE_BIN = path.join(PROJECT_ROOT, 'repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode');
const LOG_DIR = path.join(PROJECT_ROOT, 'test-results/external-validation-harness');

// ============================================================================
// Validation Test Cases
// ============================================================================

export const TEST_CASE_1_EXISTING_ACTIVITY: ValidationInput = {
  scenario: 'existing-activity',
  command: OPENCODE_BIN,
  args: ['activity', 'search', 'add REST endpoint'],
  expectedPatterns: [
    'search_activities.*called',
    'templates.*returned',
    'add-rest-endpoint',
  ],
  forbiddenPatterns: [
    'bash.*tool.*sessionID:.*root',
    'read.*tool.*sessionID:.*root',
    'edit.*tool.*sessionID:.*root',
  ],
  timeout: 30000,
};

export const TEST_CASE_2_NOVEL_GOAL: ValidationInput = {
  scenario: 'novel-goal',
  command: OPENCODE_BIN,
  args: [
    'activity',
    'create',
    '--goal',
    'Add retry logic with exponential backoff to API calls',
    '--name',
    'Add API Retry Logic',
    '--category',
    'feature',
  ],
  expectedPatterns: [
    'create_activity_goal_seeking.*called',
    'Goal.*decomposed',
    'Searching.*existing.*activities',
    'Template.*created',
    'Registered.*backend',
  ],
  forbiddenPatterns: [
    'Activity.*starting.*add-api-retry-logic',
    'Task.*starting',
    'bash.*tool.*sessionID:.*root',
  ],
  timeout: 120000,
};

export const TEST_CASE_3_NO_DIRECT_TOOLS: ValidationInput = {
  scenario: 'no-direct-tools',
  command: OPENCODE_BIN,
  args: ['activity', 'list'],
  expectedPatterns: [
    'list_activity_templates.*called',
    'templates.*loaded',
  ],
  forbiddenPatterns: [
    'bash.*tool.*called.*sessionID:.*root',
    'read.*tool.*called.*sessionID:.*root',
    'edit.*tool.*called.*sessionID:.*root',
    'write.*tool.*called.*sessionID:.*root',
    'glob.*tool.*called.*sessionID:.*root',
    'grep.*tool.*called.*sessionID:.*root',
  ],
  timeout: 30000,
};

// ============================================================================
// Core Validation Functions
// ============================================================================

/**
 * Execute a command and capture output
 */
async function executeCommand(
  command: string,
  args: string[],
  timeout: number
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTime: number;
}> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    const proc = spawn(command, args, {
      env: {
        ...process.env,
        OPENCODE_LOG_LEVEL: 'debug', // Enable verbose logging
      },
    });

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const executionTime = Date.now() - startTime;
      resolve({
        exitCode: code || 0,
        stdout,
        stderr,
        executionTime,
      });
    });

    proc.on('error', (err) => {
      reject(err);
    });

    // Timeout handling
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    proc.on('close', () => {
      clearTimeout(timer);
    });
  });
}

/**
 * Analyze logs for patterns
 */
function analyzeLogs(
  logs: string[],
  expectedPatterns: string[],
  forbiddenPatterns: string[]
): {
  patternsFound: string[];
  patternsMissing: string[];
  forbiddenPatternsFound: string[];
  evidence: string[];
} {
  const patternsFound: string[] = [];
  const patternsMissing: string[] = [];
  const forbiddenPatternsFound: string[] = [];
  const evidence: string[] = [];

  // Check expected patterns
  for (const pattern of expectedPatterns) {
    const regex = new RegExp(pattern);
    const found = logs.some((line) => regex.test(line));

    if (found) {
      patternsFound.push(pattern);
      const matchedLines = logs.filter((line) => regex.test(line));
      evidence.push(`✅ Pattern found: ${pattern}`);
      evidence.push(`   Matched lines: ${matchedLines.length}`);
      evidence.push(`   Sample: ${matchedLines[0]?.substring(0, 100)}...`);
    } else {
      patternsMissing.push(pattern);
      evidence.push(`❌ Pattern missing: ${pattern}`);
    }
  }

  // Check forbidden patterns
  for (const pattern of forbiddenPatterns) {
    const regex = new RegExp(pattern);
    const matches = logs.filter((line) => regex.test(line));

    if (matches.length > 0) {
      forbiddenPatternsFound.push(pattern);
      evidence.push(`❌ FORBIDDEN pattern found: ${pattern}`);
      evidence.push(`   Occurrences: ${matches.length}`);
      evidence.push(`   Sample: ${matches[0]?.substring(0, 100)}...`);
    } else {
      evidence.push(`✅ Forbidden pattern absent: ${pattern}`);
    }
  }

  return {
    patternsFound,
    patternsMissing,
    forbiddenPatternsFound,
    evidence,
  };
}

/**
 * Run a single validation test case
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const errors: string[] = [];
  let actual: ValidationOutput['actual'];

  try {
    // Check if OpenCode binary exists
    if (!fs.existsSync(input.command)) {
      errors.push(`OpenCode binary not found at: ${input.command}`);
      errors.push('Please build distribution: cd repos/metabob-opencode && npm run build:dist');

      return {
        pass: false,
        actual: {
          exitCode: -1,
          stdout: '',
          stderr: '',
          logs: [],
          executionTime: 0,
          patternsFound: [],
          patternsMissing: input.expectedPatterns,
          forbiddenPatternsFound: [],
        },
        expected: {
          exitCode: 0,
          requiredPatterns: input.expectedPatterns,
          forbiddenPatterns: input.forbiddenPatterns,
        },
        evidence: [],
        errors,
      };
    }

    // Execute command
    const result = await executeCommand(input.command, input.args, input.timeout);

    // Combine stdout and stderr as logs
    const logs = [...result.stdout.split('\n'), ...result.stderr.split('\n')].filter(
      (line) => line.trim().length > 0
    );

    // Analyze logs
    const analysis = analyzeLogs(logs, input.expectedPatterns, input.forbiddenPatterns);

    actual = {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      logs,
      executionTime: result.executionTime,
      ...analysis,
    };

    // Determine pass/fail
    const allPatternsFound = analysis.patternsMissing.length === 0;
    const noForbiddenPatterns = analysis.forbiddenPatternsFound.length === 0;
    const exitCodeCorrect = result.exitCode === 0;

    const pass = allPatternsFound && noForbiddenPatterns && exitCodeCorrect;

    if (!allPatternsFound) {
      errors.push(`Missing ${analysis.patternsMissing.length} required pattern(s)`);
    }
    if (!noForbiddenPatterns) {
      errors.push(`Found ${analysis.forbiddenPatternsFound.length} forbidden pattern(s)`);
    }
    if (!exitCodeCorrect) {
      errors.push(`Exit code ${result.exitCode}, expected 0`);
    }

    return {
      pass,
      actual,
      expected: {
        exitCode: 0,
        requiredPatterns: input.expectedPatterns,
        forbiddenPatterns: input.forbiddenPatterns,
      },
      evidence: analysis.evidence,
      errors,
    };
  } catch (error) {
    errors.push(`Execution error: ${error instanceof Error ? error.message : String(error)}`);

    return {
      pass: false,
      actual: {
        exitCode: -1,
        stdout: '',
        stderr: '',
        logs: [],
        executionTime: 0,
        patternsFound: [],
        patternsMissing: input.expectedPatterns,
        forbiddenPatternsFound: [],
      },
      expected: {
        exitCode: 0,
        requiredPatterns: input.expectedPatterns,
        forbiddenPatterns: input.forbiddenPatterns,
      },
      evidence: [],
      errors,
    };
  }
}

/**
 * Run all validation test cases
 */
export async function runAllValidations(): Promise<ValidationResult> {
  const timestamp = Date.now();

  console.log('='.repeat(80));
  console.log('External Activity System Validation Harness');
  console.log('='.repeat(80));
  console.log('');

  // Create log directory
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  const testCases = [
    { id: 'case-1-existing-activity', input: TEST_CASE_1_EXISTING_ACTIVITY },
    { id: 'case-2-novel-goal', input: TEST_CASE_2_NOVEL_GOAL },
    { id: 'case-3-no-direct-tools', input: TEST_CASE_3_NO_DIRECT_TOOLS },
  ];

  const results: ValidationResult['testCases'] = [];

  for (const testCase of testCases) {
    console.log(`Running: ${testCase.id}...`);

    const output = await runValidation(testCase.input);

    results.push({
      id: testCase.id,
      input: testCase.input,
      output,
      passed: output.pass,
    });

    // Save logs
    const logFile = path.join(LOG_DIR, `${testCase.id}-${timestamp}.log`);
    fs.writeFileSync(
      logFile,
      [
        `Test Case: ${testCase.id}`,
        `Timestamp: ${new Date(timestamp).toISOString()}`,
        `Status: ${output.pass ? 'PASS' : 'FAIL'}`,
        '',
        'Command:',
        `${testCase.input.command} ${testCase.input.args.join(' ')}`,
        '',
        'Evidence:',
        ...output.evidence,
        '',
        'Errors:',
        ...output.errors,
        '',
        'Logs:',
        ...output.actual.logs,
      ].join('\n')
    );

    console.log(`  Status: ${output.pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Log: ${logFile}`);
    console.log('');
  }

  // Calculate summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const overallPass = failed === 0;

  // Meta-validation
  const metaValidation = {
    testedCompiledDistribution: results.every((r) => r.input.command === OPENCODE_BIN),
    testedExistingActivity: results.some((r) => r.id === 'case-1-existing-activity'),
    testedGoalSeeking: results.some((r) => r.id === 'case-2-novel-goal'),
    testedNoDirectTools: results.some((r) => r.id === 'case-3-no-direct-tools'),
    testedLogAnalysis: results.every((r) => r.output.evidence.length > 0),
    allRequirementsTested: false,
  };

  metaValidation.allRequirementsTested = Object.values(metaValidation)
    .slice(0, -1)
    .every((v) => v === true);

  const result: ValidationResult = {
    specificationName: 'external-activity-system-validation',
    timestamp,
    testCases: results,
    summary: {
      totalTests: results.length,
      passed,
      failed,
      overallPass,
    },
    metaValidation,
  };

  // Print summary
  console.log('='.repeat(80));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(80));
  console.log('');
  console.log(`Total tests: ${result.summary.totalTests}`);
  console.log(`Passed: ${result.summary.passed}`);
  console.log(`Failed: ${result.summary.failed}`);
  console.log('');
  console.log('Meta-Validation:');
  console.log(`  ✓ Tested compiled distribution: ${metaValidation.testedCompiledDistribution}`);
  console.log(`  ✓ Tested existing activity: ${metaValidation.testedExistingActivity}`);
  console.log(`  ✓ Tested goal-seeking: ${metaValidation.testedGoalSeeking}`);
  console.log(`  ✓ Tested no direct tools: ${metaValidation.testedNoDirectTools}`);
  console.log(`  ✓ Tested log analysis: ${metaValidation.testedLogAnalysis}`);
  console.log(`  ✓ All requirements tested: ${metaValidation.allRequirementsTested}`);
  console.log('');
  console.log(`Overall Result: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(80));

  // Save result
  const resultFile = path.join(LOG_DIR, `validation-result-${timestamp}.json`);
  fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
  console.log(`\nResults saved to: ${resultFile}`);

  return result;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  runAllValidations()
    .then((result) => {
      process.exit(result.summary.overallPass ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
