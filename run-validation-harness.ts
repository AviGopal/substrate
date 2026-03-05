#!/usr/bin/env bun
/**
 * Run validation harness and capture results
 */

import { runValidation } from './tests/validation-harnesses/activity-template-flow-via-mcp-backend-harness';
import fs from 'fs';

console.log('🔍 Running Activity Template Flow via MCP Backend Validation Harness\n');

const baseDir = process.cwd();

try {
  const output = await runValidation(baseDir);
  
  // Create detailed validation results
  const validationResults = {
    specificationName: "Activity Template Flow via MCP Backend",
    timestamp: new Date().toISOString(),
    overallStatus: output.pass ? "PASS" : "FAIL",
    summary: {
      totalTests: output.totalTests,
      passed: output.passed,
      failed: output.failed
    },
    validationResults: output.results.map((result, index) => ({
      testCaseNumber: index + 1,
      testCase: `validation-activity-template-flow-via-mcp-backend-case-${index + 1}`,
      testName: result.testName,
      status: result.pass ? "PASS" : "FAIL",
      actual: result.actual,
      expected: result.expected,
      details: result.details || result.error || "",
      difference: result.pass ? null : (result.error || "Actual output does not match expected output")
    })),
    resultsImpulseId: "validation-results-activity-template-flow-via-mcp-backend"
  };
  
  // Write results to file
  fs.writeFileSync(
    './validation-results.json',
    JSON.stringify(validationResults, null, 2)
  );
  
  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`Overall Status: ${validationResults.overallStatus}`);
  console.log(`Total Tests: ${output.totalTests}`);
  console.log(`Passed: ${output.passed}`);
  console.log(`Failed: ${output.failed}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Print failed tests
  if (output.failed > 0) {
    console.log('❌ Failed Tests:\n');
    output.results
      .filter(r => !r.pass)
      .forEach((r, i) => {
        console.log(`${i + 1}. ${r.testName}`);
        console.log(`   ${r.error || r.details || 'Check failed'}\n`);
      });
  }
  
  console.log(`\n✅ Results saved to: ./validation-results.json`);
  
  process.exit(output.pass ? 0 : 1);
} catch (error) {
  console.error('❌ Validation harness error:', error);
  process.exit(1);
}
