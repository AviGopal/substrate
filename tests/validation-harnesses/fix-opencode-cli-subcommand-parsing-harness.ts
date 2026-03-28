/**
 * Validation Harness: fix-opencode-cli-subcommand-parsing
 * 
 * Purpose: Validate that OpenCode CLI correctly distinguishes between
 * registered subcommands and template IDs, fixing the bug where subcommands
 * were incorrectly treated as templates requiring --variables flag.
 * 
 * Test Strategy:
 * 1. Test subcommands work without --variables (list, search, template, etc.)
 * 2. Test unknown template IDs still require --variables (backward compatibility)
 * 3. Test template execution with --variables still works (no regression)
 * 4. Test all 10 registered subcommands individually
 */

import { execSync, ExecSyncOptions } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

// Registered subcommands that should NOT require --variables
const REGISTERED_SUBCOMMANDS = [
  'list',
  'template',
  'run',
  'init',
  'clear',
  'metrics',
  'recommend',
  'search',
  'promote',
  'evolve',
]

interface ValidationInput {
  command: string
  args: string[]
  options?: Record<string, string>
  expectedToRequireVariables: boolean
}

interface ValidationOutput {
  pass: boolean
  actual: {
    exitCode: number
    stdout: string
    stderr: string
    errorMessage?: string
  }
  expected: {
    exitCode: number
    errorShouldContain?: string
    errorShouldNotContain?: string
    shouldExecute: boolean
  }
  testName: string
  details?: string
}

/**
 * Execute OpenCode CLI command and capture output
 */
function executeCommand(
  args: string[],
  options?: Record<string, string>
): { exitCode: number; stdout: string; stderr: string } {
  const cwd = path.resolve(__dirname, '../../repos/metabob-opencode/packages/opencode')
  
  // Build command with options
  let cmdArgs = ['node', 'dist/cli/index.js', ...args]
  
  if (options) {
    Object.entries(options).forEach(([key, value]) => {
      cmdArgs.push(`--${key}`)
      cmdArgs.push(value)
    })
  }
  
  const cmd = cmdArgs.join(' ')
  
  const execOptions: ExecSyncOptions = {
    cwd,
    encoding: 'utf-8',
    stdio: 'pipe',
  }
  
  try {
    const stdout = execSync(cmd, execOptions)
    return { exitCode: 0, stdout: stdout.toString(), stderr: '' }
  } catch (error: any) {
    return {
      exitCode: error.status || 1,
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || error.message || '',
    }
  }
}

/**
 * Test Case 1: Subcommands should work without --variables
 */
export function testSubcommandWithoutVariables(subcommand: string): ValidationOutput {
  const input: ValidationInput = {
    command: `opencode activity ${subcommand}`,
    args: ['activity', subcommand],
    expectedToRequireVariables: false,
  }
  
  const result = executeCommand(input.args)
  
  const expected = {
    exitCode: 0,
    errorShouldNotContain: '--variables is required',
    shouldExecute: true,
  }
  
  const hasVariablesError = result.stderr.includes('--variables is required')
  const pass = !hasVariablesError
  
  return {
    pass,
    actual: {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      errorMessage: hasVariablesError ? result.stderr : undefined,
    },
    expected,
    testName: `Subcommand '${subcommand}' should work without --variables`,
    details: pass
      ? `✓ Subcommand executed without requiring --variables`
      : `✗ Subcommand incorrectly requires --variables`,
  }
}

/**
 * Test Case 2: Unknown template IDs should still require --variables
 */
export function testUnknownTemplateRequiresVariables(): ValidationOutput {
  const input: ValidationInput = {
    command: 'opencode activity my-custom-template',
    args: ['activity', 'my-custom-template'],
    expectedToRequireVariables: true,
  }
  
  const result = executeCommand(input.args)
  
  const expected = {
    exitCode: 1,
    errorShouldContain: '--variables is required',
    shouldExecute: false,
  }
  
  const hasVariablesError = result.stderr.includes('--variables is required')
  const pass = hasVariablesError && result.exitCode !== 0
  
  return {
    pass,
    actual: {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      errorMessage: result.stderr,
    },
    expected,
    testName: 'Template execution should still require --variables',
    details: pass
      ? `✓ Unknown template correctly requires --variables`
      : `✗ Unknown template should require --variables but doesn't`,
  }
}

/**
 * Test Case 3: Template execution with --variables should work (regression)
 */
export function testTemplateExecutionWithVariables(): ValidationOutput {
  // Note: This will try to execute a template, which may fail if template doesn't exist
  // but should NOT fail with "--variables is required" error
  const input: ValidationInput = {
    command: 'opencode activity test-template --variables \'{"key":"value"}\' --reason \'testing\'',
    args: ['activity', 'test-template'],
    options: {
      variables: '{"key":"value"}',
      reason: 'testing',
    },
    expectedToRequireVariables: true,
  }
  
  const result = executeCommand(input.args, input.options)
  
  const expected = {
    exitCode: 0, // May fail with "template not found" but not "--variables required"
    errorShouldNotContain: '--variables is required',
    shouldExecute: true,
  }
  
  const hasVariablesError = result.stderr.includes('--variables is required')
  const pass = !hasVariablesError // Should not see this error when --variables is provided
  
  return {
    pass,
    actual: {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      errorMessage: hasVariablesError ? result.stderr : undefined,
    },
    expected,
    testName: 'Template execution with --variables should work (regression test)',
    details: pass
      ? `✓ Template execution accepts --variables (no regression)`
      : `✗ Regression detected: --variables flag not working`,
  }
}

/**
 * Test Case 4: All registered subcommands should work
 */
export function testAllRegisteredSubcommands(): ValidationOutput {
  const results = REGISTERED_SUBCOMMANDS.map((subcommand) => {
    const result = executeCommand(['activity', subcommand])
    return {
      subcommand,
      hasVariablesError: result.stderr.includes('--variables is required'),
      exitCode: result.exitCode,
    }
  })
  
  const failedSubcommands = results.filter((r) => r.hasVariablesError)
  const pass = failedSubcommands.length === 0
  
  return {
    pass,
    actual: {
      exitCode: pass ? 0 : 1,
      stdout: JSON.stringify(results, null, 2),
      stderr: failedSubcommands.length > 0
        ? `Failed subcommands: ${failedSubcommands.map((r) => r.subcommand).join(', ')}`
        : '',
    },
    expected: {
      exitCode: 0,
      errorShouldNotContain: '--variables is required',
      shouldExecute: true,
    },
    testName: 'All registered subcommands should work',
    details: pass
      ? `✓ All ${REGISTERED_SUBCOMMANDS.length} subcommands work without --variables`
      : `✗ ${failedSubcommands.length}/${REGISTERED_SUBCOMMANDS.length} subcommands fail: ${failedSubcommands.map((r) => r.subcommand).join(', ')}`,
  }
}

/**
 * Main validation runner - runs all test cases
 */
export function runValidation(
  input?: ValidationInput
): ValidationOutput | ValidationOutput[] {
  // If specific input provided, run that test
  if (input) {
    const result = executeCommand(input.args, input.options)
    
    const expected = input.expectedToRequireVariables
      ? {
          exitCode: 1,
          errorShouldContain: '--variables is required',
          shouldExecute: false,
        }
      : {
          exitCode: 0,
          errorShouldNotContain: '--variables is required',
          shouldExecute: true,
        }
    
    const hasVariablesError = result.stderr.includes('--variables is required')
    const pass = input.expectedToRequireVariables
      ? hasVariablesError && result.exitCode !== 0
      : !hasVariablesError
    
    return {
      pass,
      actual: {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        errorMessage: hasVariablesError ? result.stderr : undefined,
      },
      expected,
      testName: `Custom test: ${input.command}`,
    }
  }
  
  // Run all test cases
  const results: ValidationOutput[] = [
    // Test each subcommand individually
    ...REGISTERED_SUBCOMMANDS.slice(0, 3).map(testSubcommandWithoutVariables), // Sample 3
    
    // Test template validation still works
    testUnknownTemplateRequiresVariables(),
    
    // Test template execution with variables works (regression)
    testTemplateExecutionWithVariables(),
    
    // Test all subcommands together
    testAllRegisteredSubcommands(),
  ]
  
  return results
}

/**
 * Run validation and print results
 */
export function runAndPrintValidation(): void {
  console.log('🧪 Running Validation Harness: fix-opencode-cli-subcommand-parsing\n')
  
  const results = runValidation() as ValidationOutput[]
  
  let passed = 0
  let failed = 0
  
  results.forEach((result, index) => {
    const icon = result.pass ? '✓' : '✗'
    const status = result.pass ? 'PASS' : 'FAIL'
    
    console.log(`${index + 1}. ${icon} ${result.testName} - ${status}`)
    if (result.details) {
      console.log(`   ${result.details}`)
    }
    if (!result.pass && result.actual.errorMessage) {
      console.log(`   Error: ${result.actual.errorMessage.substring(0, 100)}...`)
    }
    console.log()
    
    if (result.pass) {
      passed++
    } else {
      failed++
    }
  })
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${results.length} tests`)
  console.log(failed === 0 ? '✅ All tests passed!' : '❌ Some tests failed')
  
  process.exit(failed > 0 ? 1 : 0)
}

// Run if executed directly
if (require.main === module) {
  runAndPrintValidation()
}
