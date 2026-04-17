#!/usr/bin/env bun
/**
 * Sequence Validation Test Runner
 *
 * Validates that MiniBob's implementation matches the documented
 * sequences in /docs/architecture/sequences/
 */

import { parseArgs } from "util";
import { existsSync } from "fs";
import { resolve } from "path";

interface TestResult {
  sequence: string;
  passed: number;
  failed: number;
  skipped: number;
  errors: Array<{ test: string; error: string }>;
  duration: number;
}

interface TestOptions {
  sequence?: string;
  report?: "alignment" | "coverage" | "traces";
  verbose?: boolean;
  backend?: string;
}

const SEQUENCES = [
  "01-activity-selection",
  "02-impulse-resolution",
  "03-resolver-processing",
  "04-improvisation",
  "05-hooks",
];

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      sequence: { type: "string" },
      report: { type: "string" },
      verbose: { type: "boolean", default: false },
      backend: { type: "string", default: "https://activity.metabob.com" },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const options: TestOptions = {
    sequence: values.sequence as string | undefined,
    report: values.report as "alignment" | "coverage" | "traces" | undefined,
    verbose: values.verbose,
    backend: values.backend,
  };

  console.log("🧪 MiniBob Sequence Validation Suite\n");
  console.log(`Backend: ${options.backend}`);
  console.log(`Verbose: ${options.verbose ? "enabled" : "disabled"}\n`);

  // Determine which sequences to test
  const sequencesToTest = options.sequence
    ? [options.sequence]
    : SEQUENCES;

  // Validate sequence names
  for (const seq of sequencesToTest) {
    if (!SEQUENCES.includes(seq)) {
      console.error(`❌ Unknown sequence: ${seq}`);
      console.error(`   Available: ${SEQUENCES.join(", ")}`);
      process.exit(1);
    }
  }

  // Run tests
  const results: TestResult[] = [];
  for (const seq of sequencesToTest) {
    const result = await runSequenceTest(seq, options);
    results.push(result);
  }

  // Print summary
  printSummary(results);

  // Generate report if requested
  if (options.report) {
    await generateReport(options.report, results);
  }

  // Exit with error code if any tests failed
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  process.exit(totalFailed > 0 ? 1 : 0);
}

async function runSequenceTest(
  sequence: string,
  options: TestOptions
): Promise<TestResult> {
  const testFile = resolve(__dirname, "tests", `${sequence}.test.ts`);

  if (!existsSync(testFile)) {
    console.log(`⚠️  ${sequence}: Test file not found (skipping)`);
    return {
      sequence,
      passed: 0,
      failed: 0,
      skipped: 1,
      errors: [],
      duration: 0,
    };
  }

  console.log(`\n📋 Running ${sequence}...`);

  const startTime = Date.now();

  try {
    // Import and run test module
    const testModule = await import(testFile);

    if (!testModule.default || typeof testModule.default !== "function") {
      throw new Error(`Test file ${sequence}.test.ts must export default function`);
    }

    const result = await testModule.default(options);
    const duration = Date.now() - startTime;

    console.log(`✅ ${sequence}: ${result.passed} passed, ${result.failed} failed (${duration}ms)`);

    return { ...result, sequence, duration };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ ${sequence}: Test execution failed`);
    console.error(`   ${error.message}`);

    return {
      sequence,
      passed: 0,
      failed: 1,
      skipped: 0,
      errors: [{ test: "execution", error: error.message }],
      duration,
    };
  }
}

function printSummary(results: TestResult[]) {
  console.log("\n" + "=".repeat(60));
  console.log("📊 Test Summary");
  console.log("=".repeat(60));

  const totals = {
    passed: results.reduce((sum, r) => sum + r.passed, 0),
    failed: results.reduce((sum, r) => sum + r.failed, 0),
    skipped: results.reduce((sum, r) => sum + r.skipped, 0),
    duration: results.reduce((sum, r) => sum + r.duration, 0),
  };

  console.log(`\nTotal: ${totals.passed + totals.failed + totals.skipped} tests`);
  console.log(`  ✅ Passed:  ${totals.passed}`);
  console.log(`  ❌ Failed:  ${totals.failed}`);
  console.log(`  ⚠️  Skipped: ${totals.skipped}`);
  console.log(`  ⏱️  Duration: ${totals.duration}ms\n`);

  if (totals.failed > 0) {
    console.log("❌ Failures:\n");
    for (const result of results) {
      if (result.errors.length > 0) {
        console.log(`  ${result.sequence}:`);
        for (const error of result.errors) {
          console.log(`    - ${error.test}: ${error.error}`);
        }
      }
    }
    console.log();
  }

  const coverage = totals.passed + totals.failed > 0
    ? (totals.passed / (totals.passed + totals.failed) * 100).toFixed(1)
    : "0.0";

  console.log(`Coverage: ${coverage}%`);
  console.log("=".repeat(60) + "\n");
}

async function generateReport(
  type: "alignment" | "coverage" | "traces",
  results: TestResult[]
) {
  console.log(`\n📄 Generating ${type} report...`);

  const reportDir = resolve(__dirname, "reports", type);
  await Bun.write(
    `${reportDir}/latest.json`,
    JSON.stringify(results, null, 2)
  );

  if (type === "alignment") {
    await generateAlignmentReport(results, reportDir);
  } else if (type === "coverage") {
    await generateCoverageReport(results, reportDir);
  }

  console.log(`✅ Report saved to: ${reportDir}/\n`);
}

async function generateAlignmentReport(results: TestResult[], reportDir: string) {
  const report = [
    "# Sequence Validation Alignment Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    ...results.map((r) => {
      const status = r.failed === 0 ? "✅" : "❌";
      return `- ${status} ${r.sequence}: ${r.passed}/${r.passed + r.failed} behaviors validated`;
    }),
    "",
    "## Details",
    "",
  ];

  for (const result of results) {
    report.push(`### ${result.sequence}`);
    report.push("");
    report.push(`**Tests Passed:** ${result.passed}`);
    report.push(`**Tests Failed:** ${result.failed}`);
    report.push(`**Duration:** ${result.duration}ms`);

    if (result.errors.length > 0) {
      report.push("");
      report.push("**Failures:**");
      for (const error of result.errors) {
        report.push(`- ${error.test}: ${error.error}`);
      }
    }

    report.push("");
  }

  await Bun.write(`${reportDir}/alignment-report.md`, report.join("\n"));
}

async function generateCoverageReport(results: TestResult[], reportDir: string) {
  const totalTests = results.reduce((sum, r) => sum + r.passed + r.failed, 0);
  const passedTests = results.reduce((sum, r) => sum + r.passed, 0);
  const coverage = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(2) : "0.00";

  const report = {
    timestamp: new Date().toISOString(),
    coverage: parseFloat(coverage),
    totalTests,
    passedTests,
    failedTests: totalTests - passedTests,
    sequences: results.map((r) => ({
      name: r.sequence,
      passed: r.passed,
      failed: r.failed,
      coverage: r.passed + r.failed > 0
        ? (r.passed / (r.passed + r.failed) * 100).toFixed(2)
        : "0.00",
    })),
  };

  await Bun.write(`${reportDir}/coverage.json`, JSON.stringify(report, null, 2));
}

function printHelp() {
  console.log(`
MiniBob Sequence Validation Test Runner

Usage:
  bun run-tests.ts [options]

Options:
  --sequence <name>    Run specific sequence test (e.g., 01-activity-selection)
  --report <type>      Generate report: alignment | coverage | traces
  --verbose            Enable verbose output
  --backend <url>      Backend URL (default: https://activity.metabob.com)
  --help               Show this help message

Examples:
  bun run-tests.ts
  bun run-tests.ts --sequence 01-activity-selection --verbose
  bun run-tests.ts --report alignment

Available Sequences:
  ${SEQUENCES.map(s => `  - ${s}`).join("\n")}
`);
}

// Run if executed directly
if (import.meta.main) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { runSequenceTest, type TestOptions, type TestResult };
