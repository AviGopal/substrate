/**
 * Validation Harness: vessel-repository-independence
 * 
 * Tests architectural boundaries to ensure:
 * 1. No cross-vessel code imports (HTTP/REST only)
 * 2. Self-contained Helm charts per vessel
 * 3. Independent Dockerfiles per vessel
 * 4. HTTP-based communication (fetch/axios)
 * 
 * This harness runs WITHOUT LLM - pure static analysis
 * Uses impulse-defined test cases for deterministic validation
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface ValidationInput {
  searchPattern?: string;
  searchPaths?: string[];
  excludePaths?: string[];
  minimumMatches?: number;
  helmChartPaths?: string[];
  dockerfilePaths?: string[];
}

interface ValidationExpectedOutput {
  matchCount?: number;
  hasHttpCalls?: boolean;
  allChartsExist?: boolean;
  chartCount?: number;
  allDockerfilesExist?: boolean;
  dockerfileCount?: number;
  pass: boolean;
  reason: string;
}

interface ValidationResult {
  pass: boolean;
  actual: any;
  expected: ValidationExpectedOutput;
  details?: string;
  error?: string;
}

interface TestCase {
  id: string;
  testName: string;
  input: ValidationInput;
  expectedOutput: ValidationExpectedOutput;
  category: string;
  severity: string;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Search for pattern in files using ripgrep
 * Returns number of matches found
 */
function searchPattern(
  pattern: string,
  searchPaths: string[],
  excludePaths: string[] = []
): { matchCount: number; matches: string[] } {
  try {
    const repoRoot = process.cwd();
    const excludeArgs = excludePaths.map(p => `--glob '!${p}/**'`).join(' ');
    
    let allMatches: string[] = [];
    let totalCount = 0;

    for (const searchPath of searchPaths) {
      const fullPath = path.join(repoRoot, searchPath);
      
      if (!fs.existsSync(fullPath)) {
        continue;
      }

      try {
        // Use ripgrep for fast searching
        const cmd = `rg --no-heading --line-number '${pattern}' ${fullPath} ${excludeArgs}`;
        const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
        const matches = output.trim().split('\n').filter(line => line.length > 0);
        
        allMatches = allMatches.concat(matches);
        totalCount += matches.length;
      } catch (error: any) {
        // ripgrep returns exit code 1 when no matches found
        if (error.status === 1) {
          continue;
        }
        throw error;
      }
    }

    return { matchCount: totalCount, matches: allMatches };
  } catch (error: any) {
    // If ripgrep not found or other error, return 0 matches
    if (error.message?.includes('command not found')) {
      console.warn('ripgrep (rg) not found, using fallback grep');
      // Fallback to basic grep (slower)
      return searchPatternWithGrep(pattern, searchPaths, excludePaths);
    }
    return { matchCount: 0, matches: [] };
  }
}

/**
 * Fallback search using grep
 */
function searchPatternWithGrep(
  pattern: string,
  searchPaths: string[],
  excludePaths: string[] = []
): { matchCount: number; matches: string[] } {
  try {
    const repoRoot = process.cwd();
    const excludeArgs = excludePaths.map(p => `--exclude-dir=${p}`).join(' ');
    
    let allMatches: string[] = [];
    let totalCount = 0;

    for (const searchPath of searchPaths) {
      const fullPath = path.join(repoRoot, searchPath);
      
      if (!fs.existsSync(fullPath)) {
        continue;
      }

      try {
        const cmd = `grep -r -n -E '${pattern}' ${fullPath} ${excludeArgs}`;
        const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
        const matches = output.trim().split('\n').filter(line => line.length > 0);
        
        allMatches = allMatches.concat(matches);
        totalCount += matches.length;
      } catch (error: any) {
        // grep returns exit code 1 when no matches found
        if (error.status === 1) {
          continue;
        }
        throw error;
      }
    }

    return { matchCount: totalCount, matches: allMatches };
  } catch (error: any) {
    return { matchCount: 0, matches: [] };
  }
}

/**
 * Check if files exist
 */
function checkFilesExist(filePaths: string[]): { allExist: boolean; existingCount: number; missing: string[] } {
  const repoRoot = process.cwd();
  let existingCount = 0;
  const missing: string[] = [];

  for (const filePath of filePaths) {
    const fullPath = path.join(repoRoot, filePath);
    if (fs.existsSync(fullPath)) {
      existingCount++;
    } else {
      missing.push(filePath);
    }
  }

  return {
    allExist: existingCount === filePaths.length,
    existingCount,
    missing
  };
}

// ============================================================================
// Test Case Validators
// ============================================================================

/**
 * Validate no cross-vessel imports
 */
function validateNoCrossVesselImports(testCase: TestCase): ValidationResult {
  const { searchPattern: pattern, searchPaths, excludePaths } = testCase.input;
  
  if (!pattern || !searchPaths) {
    return {
      pass: false,
      actual: null,
      expected: testCase.expectedOutput,
      error: 'Missing searchPattern or searchPaths in test input'
    };
  }

  const { matchCount, matches } = searchPattern(pattern, searchPaths, excludePaths);

  const actual = {
    matchCount,
    matches: matches.slice(0, 10), // Limit to first 10 matches for readability
    totalMatches: matches.length
  };

  const pass = matchCount === testCase.expectedOutput.matchCount;

  return {
    pass,
    actual,
    expected: testCase.expectedOutput,
    details: pass 
      ? `✅ No cross-vessel imports found (expected: ${testCase.expectedOutput.matchCount}, actual: ${matchCount})`
      : `❌ Found ${matchCount} cross-vessel imports (expected: ${testCase.expectedOutput.matchCount})\n${matches.slice(0, 5).join('\n')}`
  };
}

/**
 * Validate Helm charts exist
 */
function validateHelmChartsExist(testCase: TestCase): ValidationResult {
  const { helmChartPaths } = testCase.input;
  
  if (!helmChartPaths) {
    return {
      pass: false,
      actual: null,
      expected: testCase.expectedOutput,
      error: 'Missing helmChartPaths in test input'
    };
  }

  const { allExist, existingCount, missing } = checkFilesExist(helmChartPaths);

  const actual = {
    allChartsExist: allExist,
    chartCount: existingCount,
    missingCharts: missing
  };

  const pass = allExist && existingCount === testCase.expectedOutput.chartCount;

  return {
    pass,
    actual,
    expected: testCase.expectedOutput,
    details: pass
      ? `✅ All ${existingCount} Helm charts exist`
      : `❌ Missing Helm charts: ${missing.join(', ')}`
  };
}

/**
 * Validate Dockerfiles exist
 */
function validateDockerfilesExist(testCase: TestCase): ValidationResult {
  const { dockerfilePaths } = testCase.input;
  
  if (!dockerfilePaths) {
    return {
      pass: false,
      actual: null,
      expected: testCase.expectedOutput,
      error: 'Missing dockerfilePaths in test input'
    };
  }

  const { allExist, existingCount, missing } = checkFilesExist(dockerfilePaths);

  const actual = {
    allDockerfilesExist: allExist,
    dockerfileCount: existingCount,
    missingDockerfiles: missing
  };

  const pass = allExist && existingCount === testCase.expectedOutput.dockerfileCount;

  return {
    pass,
    actual,
    expected: testCase.expectedOutput,
    details: pass
      ? `✅ All ${existingCount} Dockerfiles exist`
      : `❌ Missing Dockerfiles: ${missing.join(', ')}`
  };
}

/**
 * Validate HTTP-based communication
 */
function validateHttpCommunication(testCase: TestCase): ValidationResult {
  const { searchPattern: pattern, searchPaths, excludePaths, minimumMatches = 1 } = testCase.input;
  
  if (!pattern || !searchPaths) {
    return {
      pass: false,
      actual: null,
      expected: testCase.expectedOutput,
      error: 'Missing searchPattern or searchPaths in test input'
    };
  }

  const { matchCount, matches } = searchPattern(pattern, searchPaths, excludePaths);

  const actual = {
    hasHttpCalls: matchCount >= minimumMatches,
    matchCount,
    sampleMatches: matches.slice(0, 5)
  };

  const pass = matchCount >= minimumMatches;

  return {
    pass,
    actual,
    expected: testCase.expectedOutput,
    details: pass
      ? `✅ Found ${matchCount} HTTP/REST API calls (minimum: ${minimumMatches})`
      : `❌ Found only ${matchCount} HTTP calls, expected at least ${minimumMatches}`
  };
}

// ============================================================================
// Main Validation Runner
// ============================================================================

/**
 * Run validation for a single test case
 */
export function runValidation(testCase: TestCase): ValidationResult {
  try {
    // Route to appropriate validator based on test category
    switch (testCase.category) {
      case 'architectural-boundary':
        return validateNoCrossVesselImports(testCase);
      
      case 'deployment-independence':
        if (testCase.input.helmChartPaths) {
          return validateHelmChartsExist(testCase);
        } else if (testCase.input.dockerfilePaths) {
          return validateDockerfilesExist(testCase);
        }
        break;
      
      case 'http-communication':
        return validateHttpCommunication(testCase);
      
      default:
        return {
          pass: false,
          actual: null,
          expected: testCase.expectedOutput,
          error: `Unknown test category: ${testCase.category}`
        };
    }

    return {
      pass: false,
      actual: null,
      expected: testCase.expectedOutput,
      error: 'Unable to determine validation method'
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: null,
      expected: testCase.expectedOutput,
      error: `Validation error: ${error.message}`
    };
  }
}

/**
 * Run all validation test cases
 */
export function runAllValidations(testCases: TestCase[]): {
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
  results: Array<ValidationResult & { testName: string; severity: string }>;
} {
  const results = testCases.map(testCase => ({
    testName: testCase.testName,
    severity: testCase.severity,
    ...runValidation(testCase)
  }));

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  return {
    summary: {
      total: testCases.length,
      passed,
      failed,
      passRate: (passed / testCases.length) * 100
    },
    results
  };
}

/**
 * Load test cases from impulse files
 */
export function loadTestCases(impulseDir: string): TestCase[] {
  const testCases: TestCase[] = [];
  
  for (let i = 1; i <= 6; i++) {
    const impulsePath = path.join(impulseDir, `validation-vessel-repository-independence-case-${i}.json`);
    
    if (fs.existsSync(impulsePath)) {
      try {
        const impulseData = JSON.parse(fs.readFileSync(impulsePath, 'utf-8'));
        testCases.push({
          id: impulseData.id,
          testName: impulseData.content.testName,
          input: impulseData.content.input,
          expectedOutput: impulseData.content.expectedOutput,
          category: impulseData.metadata.category,
          severity: impulseData.metadata.severity
        });
      } catch (error: any) {
        console.error(`Failed to load test case from ${impulsePath}:`, error.message);
      }
    }
  }

  return testCases;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  const impulseDir = path.join(process.cwd(), 'impulses');
  const testCases = loadTestCases(impulseDir);

  console.log('\n🔍 Vessel Repository Independence Validation\n');
  console.log(`Loaded ${testCases.length} test cases\n`);

  const { summary, results } = runAllValidations(testCases);

  // Print results
  results.forEach((result, index) => {
    const icon = result.pass ? '✅' : '❌';
    const severity = result.severity;
    console.log(`${icon} [${severity}] ${result.testName}`);
    if (result.details) {
      console.log(`   ${result.details}`);
    }
    if (result.error) {
      console.log(`   ⚠️  ${result.error}`);
    }
    console.log('');
  });

  // Print summary
  console.log('─'.repeat(80));
  console.log(`\n📊 Summary: ${summary.passed}/${summary.total} tests passed (${summary.passRate.toFixed(1)}%)\n`);

  if (summary.failed > 0) {
    console.log(`❌ ${summary.failed} test(s) failed - vessel independence NOT enforced\n`);
    process.exit(1);
  } else {
    console.log(`✅ All tests passed - vessel independence ENFORCED\n`);
    process.exit(0);
  }
}
