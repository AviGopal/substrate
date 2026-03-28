/**
 * Test Runner for context-requirements-evolution validation harness
 * 
 * Loads test cases and executes validation harness for each one,
 * capturing results and comparing against expected outputs.
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { runValidation } from "./context-requirements-evolution-harness";

interface TestCase {
  impulseId: string;
  description: string;
  input: any;
  expectedOutput: any;
}

interface ValidationResult {
  testCase: string;
  description: string;
  status: "PASS" | "FAIL";
  actual: any;
  expected: any;
  difference?: string;
  executionTime: number;
}

async function runAllTests(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Load test cases
  const testCaseFiles = [
    "test-case-1.json",
    "test-case-2.json",
    "test-case-3.json"
  ];

  for (const filename of testCaseFiles) {
    const filepath = join(__dirname, "../mock-data", filename);
    const testCase: TestCase = JSON.parse(readFileSync(filepath, "utf-8"));

    console.log(`\n${"=".repeat(80)}`);
    console.log(`Running: ${testCase.impulseId}`);
    console.log(`Description: ${testCase.description}`);
    console.log(`${"=".repeat(80)}\n`);

    const startTime = Date.now();

    try {
      // Run validation with test case input
      const result = await runValidation(testCase.input);
      const executionTime = Date.now() - startTime;

      // Compare actual vs expected
      const status = determineStatus(result, testCase.expectedOutput);
      const difference = status === "FAIL" 
        ? findDifferences(result, testCase.expectedOutput)
        : undefined;

      // Log results
      console.log(`Status: ${status === "PASS" ? "✅ PASS" : "❌ FAIL"}`);
      console.log(`Execution time: ${executionTime}ms`);
      
      if (status === "FAIL") {
        console.log(`\n❌ Differences found:`);
        console.log(difference);
      }

      console.log(`\nActual Results:`);
      console.log(JSON.stringify(result.actual, null, 2));

      if (result.errors.length > 0) {
        console.log(`\n❌ Errors:`);
        result.errors.forEach(err => console.log(`  - ${err}`));
      }

      if (result.warnings.length > 0) {
        console.log(`\n⚠️  Warnings:`);
        result.warnings.forEach(warn => console.log(`  - ${warn}`));
      }

      results.push({
        testCase: testCase.impulseId,
        description: testCase.description,
        status,
        actual: result.actual,
        expected: testCase.expectedOutput.actual,
        difference,
        executionTime
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.log(`Status: ❌ FAIL (Exception)`);
      console.log(`Error: ${errorMessage}`);

      results.push({
        testCase: testCase.impulseId,
        description: testCase.description,
        status: "FAIL",
        actual: null,
        expected: testCase.expectedOutput.actual,
        difference: `Exception thrown: ${errorMessage}`,
        executionTime
      });
    }
  }

  return results;
}

function determineStatus(actual: any, expected: any): "PASS" | "FAIL" {
  // Check if pass field matches
  if (actual.pass !== expected.pass) {
    return "FAIL";
  }

  // If expected to pass, verify critical fields
  if (expected.pass) {
    // Check success rates (with tolerance)
    const withSuccessTolerance = 0.1;
    const withoutSuccessTolerance = 0.1;
    const deltaTolerance = 0.1;

    if (expected.actual.withImpulseSuccessRate !== undefined) {
      const diff = Math.abs(actual.actual.withImpulseSuccessRate - expected.actual.withImpulseSuccessRate);
      if (diff > withSuccessTolerance) {
        return "FAIL";
      }
    }

    if (expected.actual.withoutImpulseSuccessRate !== undefined) {
      const diff = Math.abs(actual.actual.withoutImpulseSuccessRate - expected.actual.withoutImpulseSuccessRate);
      if (diff > withoutSuccessTolerance) {
        return "FAIL";
      }
    }

    if (expected.actual.correlationDelta !== undefined) {
      const diff = Math.abs(actual.actual.correlationDelta - expected.actual.correlationDelta);
      if (diff > deltaTolerance) {
        return "FAIL";
      }
    }

    // Check boolean fields
    if (expected.actual.templateEvolved !== undefined &&
        actual.actual.templateEvolved !== expected.actual.templateEvolved) {
      return "FAIL";
    }

    if (expected.actual.impulseInContextRequirements !== undefined &&
        actual.actual.impulseInContextRequirements !== expected.actual.impulseInContextRequirements) {
      return "FAIL";
    }
  }

  // Check errors
  if (expected.errors && expected.errors.length !== actual.errors.length) {
    return "FAIL";
  }

  return "PASS";
}

function findDifferences(actual: any, expected: any): string {
  const diffs: string[] = [];

  // Compare pass status
  if (actual.pass !== expected.pass) {
    diffs.push(`pass: expected ${expected.pass}, got ${actual.pass}`);
  }

  // Compare actual results
  if (expected.actual) {
    if (expected.actual.withImpulseSuccessRate !== undefined) {
      const diff = Math.abs(actual.actual.withImpulseSuccessRate - expected.actual.withImpulseSuccessRate);
      if (diff > 0.1) {
        diffs.push(`withImpulseSuccessRate: expected ${expected.actual.withImpulseSuccessRate}, got ${actual.actual.withImpulseSuccessRate} (diff: ${diff.toFixed(3)})`);
      }
    }

    if (expected.actual.withoutImpulseSuccessRate !== undefined) {
      const diff = Math.abs(actual.actual.withoutImpulseSuccessRate - expected.actual.withoutImpulseSuccessRate);
      if (diff > 0.1) {
        diffs.push(`withoutImpulseSuccessRate: expected ${expected.actual.withoutImpulseSuccessRate}, got ${actual.actual.withoutImpulseSuccessRate} (diff: ${diff.toFixed(3)})`);
      }
    }

    if (expected.actual.correlationDelta !== undefined) {
      const diff = Math.abs(actual.actual.correlationDelta - expected.actual.correlationDelta);
      if (diff > 0.1) {
        diffs.push(`correlationDelta: expected ${expected.actual.correlationDelta}, got ${actual.actual.correlationDelta} (diff: ${diff.toFixed(3)})`);
      }
    }

    if (expected.actual.templateEvolved !== undefined &&
        actual.actual.templateEvolved !== expected.actual.templateEvolved) {
      diffs.push(`templateEvolved: expected ${expected.actual.templateEvolved}, got ${actual.actual.templateEvolved}`);
    }

    if (expected.actual.impulseInContextRequirements !== undefined &&
        actual.actual.impulseInContextRequirements !== expected.actual.impulseInContextRequirements) {
      diffs.push(`impulseInContextRequirements: expected ${expected.actual.impulseInContextRequirements}, got ${actual.actual.impulseInContextRequirements}`);
    }
  }

  // Compare errors
  if (expected.errors && expected.errors.length !== actual.errors.length) {
    diffs.push(`errors: expected ${expected.errors.length} errors, got ${actual.errors.length}`);
  }

  return diffs.join("\n");
}

// Run tests and generate report
(async () => {
  console.log("🧪 Context Requirements Evolution - Validation Test Runner");
  console.log("=" .repeat(80));
  console.log("\nRunning validation tests with mock data...\n");

  const results = await runAllTests();

  // Generate summary
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80) + "\n");

  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  const total = results.length;
  const overallStatus = failed === 0 ? "PASS" : "FAIL";

  console.log(`Total tests: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Overall status: ${overallStatus === "PASS" ? "✅ PASS" : "❌ FAIL"}`);

  // Save results to file
  const output = {
    specificationName: "context-requirements-evolution",
    timestamp: new Date().toISOString(),
    validationResults: results,
    overallStatus,
    summary: {
      total,
      passed,
      failed
    },
    resultsImpulseId: "validation-results-context-requirements-evolution"
  };

  const outputPath = join(__dirname, "../test-results/context-requirements-evolution-validation-results.json");
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
})();
