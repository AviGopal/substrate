/**
 * Validation Harness: Dynamic Task Generation - Impulse Binding (Python Implementation)
 * 
 * This harness validates the bind_impulses_as_variables() utility function in metabob-cli.
 * 
 * Specification: dynamic-task-generation-impulse-binding-python-implementation
 * Architecture: metabob-cli (Python MCP server) + metabob-rpc-api (FastAPI backend)
 * Phase: Phase 1 - Impulse Binding Foundation
 * 
 * Validation Strategy:
 * - Python validation test: repos/metabob-cli/tests/mcp/validation/test_impulse_binding_validation.py
 * - Run: cd repos/metabob-cli && pytest tests/mcp/validation/test_impulse_binding_validation.py -v
 * - This TypeScript harness provides a wrapper for integration with existing TS test infrastructure
 */

import { execSync } from 'child_process';
import * as path from 'path';

/**
 * Test case structure for impulse binding validation
 */
interface TestCase {
  impulseId: string;
  input: any[];
  expectedOutput: {
    previous_commands: string[];
    test_results: Array<{ command: string; passed: boolean; exit_code: number }>;
    all_tests_passed: boolean;
    created_files: string[];
    generated_scripts: Array<{
      path: string;
      language: string;
      purpose: string;
      executable: boolean;
    }>;
    activity_results: Array<{
      task_id: string;
      success: boolean;
      duration_ms: number;
      cost: number;
    }>;
    previous_task_success: boolean | null;
    previous_task_duration: number;
  };
  description: string;
}

/**
 * Validation result structure
 */
interface ValidationResult {
  pass: boolean;
  case_id: string;
  description: string;
  actual?: any;
  expected?: any;
  mismatches?: string[];
  error?: string;
}

/**
 * Test cases (Historical - can be run without LLM)
 */
const TEST_CASES: Record<string, TestCase> = {
  'case-1-empty-input': {
    impulseId: 'validation-dynamic-task-generation-impulse-binding-python-implementation-case-1',
    input: [],
    expectedOutput: {
      previous_commands: [],
      test_results: [],
      all_tests_passed: true,
      created_files: [],
      generated_scripts: [],
      activity_results: [],
      previous_task_success: null,
      previous_task_duration: 0,
    },
    description: 'Empty impulses list returns default structure',
  },
  'case-2-single-test-passing': {
    impulseId: 'validation-dynamic-task-generation-impulse-binding-python-implementation-case-2',
    input: [
      {
        impulse_id: 'test-abc123',
        impulse_data: {
          type: 'testResults',
          pointer: {
            type: 'testResults',
            command: 'npm test',
            passed: true,
            exit_code: 0,
          },
        },
      },
    ],
    expectedOutput: {
      previous_commands: [],
      test_results: [{ command: 'npm test', passed: true, exit_code: 0 }],
      all_tests_passed: true,
      created_files: [],
      generated_scripts: [],
      activity_results: [],
      previous_task_success: null,
      previous_task_duration: 0,
    },
    description: 'Single passing test populates test_results with all_tests_passed=True',
  },
  'case-3-single-test-failing': {
    impulseId: 'validation-dynamic-task-generation-impulse-binding-python-implementation-case-3',
    input: [
      {
        impulse_id: 'test-def456',
        impulse_data: {
          type: 'testResults',
          pointer: {
            type: 'testResults',
            command: 'pytest tests/',
            passed: false,
            exit_code: 1,
          },
        },
      },
    ],
    expectedOutput: {
      previous_commands: [],
      test_results: [{ command: 'pytest tests/', passed: false, exit_code: 1 }],
      all_tests_passed: false,
      created_files: [],
      generated_scripts: [],
      activity_results: [],
      previous_task_success: null,
      previous_task_duration: 0,
    },
    description: 'Single failing test sets all_tests_passed=False',
  },
  'case-4-script-artifact': {
    impulseId: 'validation-dynamic-task-generation-impulse-binding-python-implementation-case-4',
    input: [
      {
        impulse_id: 'script-ghi789',
        impulse_data: {
          type: 'scriptArtifact',
          pointer: {
            type: 'scriptArtifact',
            file_path: 'deploy.sh',
            language: 'bash',
            inferred_purpose: 'deploy',
            executable: true,
          },
        },
      },
    ],
    expectedOutput: {
      previous_commands: [],
      test_results: [],
      all_tests_passed: true,
      created_files: ['deploy.sh'],
      generated_scripts: [
        { path: 'deploy.sh', language: 'bash', purpose: 'deploy', executable: true },
      ],
      activity_results: [],
      previous_task_success: null,
      previous_task_duration: 0,
    },
    description: 'Script artifact populates created_files and generated_scripts',
  },
  'case-5-task-summary': {
    impulseId: 'validation-dynamic-task-generation-impulse-binding-python-implementation-case-5',
    input: [
      {
        impulse_id: 'task-jkl012',
        impulse_data: {
          type: 'taskSummary',
          pointer: {
            type: 'taskSummary',
            task_id: 'step-1',
            success: true,
            duration_ms: 5000,
            cost: 0.02,
          },
        },
      },
    ],
    expectedOutput: {
      previous_commands: [],
      test_results: [],
      all_tests_passed: true,
      created_files: [],
      generated_scripts: [],
      activity_results: [{ task_id: 'step-1', success: true, duration_ms: 5000, cost: 0.02 }],
      previous_task_success: true,
      previous_task_duration: 5000,
    },
    description: 'Task summary populates activity_results and previous_task_* fields',
  },
  'case-6-multiple-tests-mixed': {
    impulseId: 'validation-dynamic-task-generation-impulse-binding-python-implementation-case-6',
    input: [
      {
        impulse_id: 'test-1',
        impulse_data: {
          type: 'testResults',
          pointer: {
            type: 'testResults',
            command: 'npm test:unit',
            passed: true,
            exit_code: 0,
          },
        },
      },
      {
        impulse_id: 'test-2',
        impulse_data: {
          type: 'testResults',
          pointer: {
            type: 'testResults',
            command: 'npm test:integration',
            passed: false,
            exit_code: 1,
          },
        },
      },
    ],
    expectedOutput: {
      previous_commands: [],
      test_results: [
        { command: 'npm test:unit', passed: true, exit_code: 0 },
        { command: 'npm test:integration', passed: false, exit_code: 1 },
      ],
      all_tests_passed: false,
      created_files: [],
      generated_scripts: [],
      activity_results: [],
      previous_task_success: null,
      previous_task_duration: 0,
    },
    description: 'Multiple tests with one failure sets all_tests_passed=False',
  },
  'case-7-complete-mixed-types': {
    impulseId: 'validation-dynamic-task-generation-impulse-binding-python-implementation-case-7',
    input: [
      {
        impulse_id: 'bash-1',
        impulse_data: {
          type: 'bashOutput',
          pointer: { type: 'bashOutput', command: 'git status' },
        },
      },
      {
        impulse_id: 'test-1',
        impulse_data: {
          type: 'testResults',
          pointer: {
            type: 'testResults',
            command: 'npm test',
            passed: true,
            exit_code: 0,
          },
        },
      },
      {
        impulse_id: 'script-1',
        impulse_data: {
          type: 'scriptArtifact',
          pointer: {
            type: 'scriptArtifact',
            file_path: 'test.sh',
            language: 'bash',
            inferred_purpose: 'test',
            executable: true,
          },
        },
      },
      {
        impulse_id: 'task-1',
        impulse_data: {
          type: 'taskSummary',
          pointer: {
            type: 'taskSummary',
            task_id: 'task-1',
            success: true,
            duration_ms: 3000,
            cost: 0.01,
          },
        },
      },
    ],
    expectedOutput: {
      previous_commands: ['git status'],
      test_results: [{ command: 'npm test', passed: true, exit_code: 0 }],
      all_tests_passed: true,
      created_files: ['test.sh'],
      generated_scripts: [
        { path: 'test.sh', language: 'bash', purpose: 'test', executable: true },
      ],
      activity_results: [{ task_id: 'task-1', success: true, duration_ms: 3000, cost: 0.01 }],
      previous_task_success: true,
      previous_task_duration: 3000,
    },
    description: 'Complete mixed types populate all 8 keys correctly',
  },
  'case-8-multiple-task-summaries': {
    impulseId: 'validation-dynamic-task-generation-impulse-binding-python-implementation-case-8',
    input: [
      {
        impulse_id: 'task-1',
        impulse_data: {
          type: 'taskSummary',
          pointer: {
            type: 'taskSummary',
            task_id: 'step-1',
            success: true,
            duration_ms: 2000,
            cost: 0.01,
          },
        },
      },
      {
        impulse_id: 'task-2',
        impulse_data: {
          type: 'taskSummary',
          pointer: {
            type: 'taskSummary',
            task_id: 'step-2',
            success: false,
            duration_ms: 4000,
            cost: 0.02,
          },
        },
      },
    ],
    expectedOutput: {
      previous_commands: [],
      test_results: [],
      all_tests_passed: true,
      created_files: [],
      generated_scripts: [],
      activity_results: [
        { task_id: 'step-1', success: true, duration_ms: 2000, cost: 0.01 },
        { task_id: 'step-2', success: false, duration_ms: 4000, cost: 0.02 },
      ],
      previous_task_success: false,
      previous_task_duration: 4000,
    },
    description: 'Multiple task summaries extract previous_task_* from last summary',
  },
};

/**
 * Run Python validation tests via pytest
 * 
 * This executes the Python validation harness and parses the output.
 * 
 * @returns Validation results for all test cases
 */
export async function runPythonValidation(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    // Navigate to metabob-cli and run pytest
    const cliPath = path.join(__dirname, '../../repos/metabob-cli');
    const testPath = 'tests/mcp/validation/test_impulse_binding_validation.py';

    console.log('Running Python validation tests...');
    console.log(`Working directory: ${cliPath}`);
    console.log(`Test file: ${testPath}`);

    const output = execSync(`cd ${cliPath} && pytest ${testPath} -v --tb=short`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    console.log(output);

    // Parse pytest output (simplistic parsing - assumes PASSED/FAILED markers)
    for (const [caseId, testCase] of Object.entries(TEST_CASES)) {
      const testName = `test_impulse_binding_validation[${caseId}]`;
      const passed = output.includes(`${testName} PASSED`);

      results.push({
        pass: passed,
        case_id: caseId,
        description: testCase.description,
        expected: testCase.expectedOutput,
      });
    }
  } catch (error: any) {
    console.error('Python validation failed:', error.message);

    // Mark all tests as failed
    for (const [caseId, testCase] of Object.entries(TEST_CASES)) {
      results.push({
        pass: false,
        case_id: caseId,
        description: testCase.description,
        expected: testCase.expectedOutput,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Main validation function (TypeScript wrapper for Python harness)
 * 
 * @param input Optional test case filter
 * @returns Validation results
 */
export async function runValidation(
  input?: { caseId?: string }
): Promise<{ pass: boolean; results: ValidationResult[] }> {
  console.log('\n' + '='.repeat(70));
  console.log('VALIDATION HARNESS: Dynamic Task Generation - Impulse Binding (Python)');
  console.log('Specification: dynamic-task-generation-impulse-binding-python-implementation');
  console.log('='.repeat(70) + '\n');

  const results = await runPythonValidation();

  // Filter results if specific case requested
  const filteredResults = input?.caseId
    ? results.filter((r) => r.case_id === input.caseId)
    : results;

  // Calculate summary
  const passed = filteredResults.filter((r) => r.pass).length;
  const total = filteredResults.length;
  const allPassed = passed === total;

  console.log('\n' + '='.repeat(70));
  console.log(`SUMMARY: ${passed}/${total} tests passed`);
  console.log('='.repeat(70) + '\n');

  // Print details
  for (const result of filteredResults) {
    const status = result.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${result.case_id}`);
    console.log(`       ${result.description}`);
    if (!result.pass && result.error) {
      console.log(`       ⚠️  Error: ${result.error}`);
    }
    console.log();
  }

  return {
    pass: allPassed,
    results: filteredResults,
  };
}

/**
 * Export test cases for impulse creation
 */
export { TEST_CASES };

/**
 * CLI entry point
 */
if (require.main === module) {
  runValidation()
    .then((result) => {
      process.exit(result.pass ? 0 : 1);
    })
    .catch((error) => {
      console.error('Validation harness error:', error);
      process.exit(1);
    });
}
