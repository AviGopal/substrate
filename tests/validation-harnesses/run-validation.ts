#!/usr/bin/env tsx
/**
 * Test Runner for User Activity Tracking Validation Harness
 * 
 * Usage:
 *   npx tsx tests/validation-harnesses/run-validation.ts
 *   npx tsx tests/validation-harnesses/run-validation.ts --case 1
 *   npx tsx tests/validation-harnesses/run-validation.ts --base-url http://localhost:8000
 */

import * as fs from 'fs';
import * as path from 'path';
import { runValidation, generateReport, ValidationResult } from './user-activity-tracking-harness.js';

interface TestCase {
  impulseId: string;
  name: string;
  input: any;
  expectedOutput: any;
}

interface TestCasesFile {
  testCases: TestCase[];
}

async function main() {
  const args = process.argv.slice(2);
  const baseUrl = getArg(args, '--base-url') || 'http://localhost:8000';
  const testCaseIndex = getArg(args, '--case');

  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║        User Activity Tracking - Validation Harness Test Runner               ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');

  console.log(`📊 Base URL: ${baseUrl}`);
  console.log(`📋 Loading test cases...\n`);

  // Load test cases
  const testCasesPath = path.join(__dirname, 'test-cases.json');
  const testCasesContent = fs.readFileSync(testCasesPath, 'utf-8');
  const testCasesFile: TestCasesFile = JSON.parse(testCasesContent);

  let testCases = testCasesFile.testCases;

  // Filter to specific test case if requested
  if (testCaseIndex !== null) {
    const index = parseInt(testCaseIndex, 10) - 1;
    if (index >= 0 && index < testCases.length) {
      testCases = [testCases[index]];
      console.log(`🎯 Running single test case: #${index + 1} - ${testCases[0].name}\n`);
    } else {
      console.error(`❌ Invalid test case index: ${testCaseIndex}`);
      process.exit(1);
    }
  } else {
    console.log(`🎯 Running all ${testCases.length} test cases\n`);
  }

  // Run validations
  const results: ValidationResult[] = [];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Test Case ${i + 1}: ${testCase.name}`);
    console.log(`Impulse ID: ${testCase.impulseId}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    try {
      const result = await runValidation(testCase.input, testCase.expectedOutput, baseUrl);
      results.push(result);

      // Print result
      if (result.pass) {
        console.log(`✅ PASS: ${testCase.name}\n`);
      } else {
        console.log(`❌ FAIL: ${testCase.name}\n`);
      }

      // Print step details
      console.log('Step Details:');
      for (const detail of result.details) {
        const icon = detail.passed ? '✅' : '❌';
        console.log(`  ${icon} ${detail.step}: ${detail.message}`);
      }

      console.log('\nExpected vs Actual:');
      console.log('  Expected:', JSON.stringify(result.expected, null, 2));
      console.log('  Actual:', JSON.stringify(result.actual, null, 2));
      console.log();
    } catch (error) {
      console.error(`❌ Error running test case: ${error instanceof Error ? error.message : String(error)}\n`);
      results.push({
        pass: false,
        testCase: testCase.name,
        actual: { error: String(error) },
        expected: testCase.expectedOutput,
        details: [
          {
            step: 'Test Execution',
            passed: false,
            message: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      });
    }
  }

  // Generate and print report
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log('VALIDATION REPORT');
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const report = generateReport(results);

  console.log(`Total Tests: ${report.totalTests}`);
  console.log(`Passed: ${report.passed}`);
  console.log(`Failed: ${report.failed}`);
  console.log(`Pass Rate: ${report.passRate.toFixed(2)}%\n`);

  if (report.passRate === 100) {
    console.log('🎉 All tests passed!\n');
  } else {
    console.log('⚠️  Some tests failed. See details above.\n');
  }

  // Save report to file
  const reportPath = path.join(__dirname, 'validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Detailed report saved to: ${reportPath}\n`);

  // Exit with appropriate code
  process.exit(report.failed > 0 ? 1 : 0);
}

function getArg(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index >= 0 && index + 1 < args.length) {
    return args[index + 1];
  }
  return null;
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
