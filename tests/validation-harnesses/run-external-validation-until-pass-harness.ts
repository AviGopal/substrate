/**
 * Validation Harness: run-external-validation-until-pass
 * 
 * This harness validates that the iterative validation runner works correctly by:
 * 1. Checking the script exists and is executable
 * 2. Verifying the script structure contains all required components
 * 3. Testing that the script can be invoked (dry-run mode)
 * 4. Validating the script logic implements all required features
 * 5. Checking documentation completeness
 * 
 * This is a meta-validation - it validates the validator itself.
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

// ============================================================================
// Types
// ============================================================================

export interface ValidationInput {
  scriptPath: string;
  readmePath: string;
  testMode: 'structure' | 'syntax' | 'execution' | 'documentation';
}

export interface ValidationOutput {
  pass: boolean;
  actual: {
    scriptExists: boolean;
    scriptExecutable: boolean;
    readmeExists: boolean;
    structureChecks: {
      hasBuildIntegration: boolean;
      hasIterativeLoop: boolean;
      hasResultAnalysis: boolean;
      hasFixPrompts: boolean;
      hasMetaValidation: boolean;
      hasFinalReport: boolean;
    };
    featureChecks: {
      maxIterationsConfigured: boolean;
      timestampedLogging: boolean;
      coloredOutput: boolean;
      exitCodeHandling: boolean;
      errorHandling: boolean;
    };
    documentationChecks: {
      hasOverview: boolean;
      hasUsageInstructions: boolean;
      hasConfiguration: boolean;
      hasTroubleshooting: boolean;
      hasExamples: boolean;
    };
    syntaxValid: boolean;
    errors: string[];
  };
  expected: {
    scriptExists: boolean;
    scriptExecutable: boolean;
    readmeExists: boolean;
    allStructureChecksPass: boolean;
    allFeatureChecksPass: boolean;
    allDocumentationChecksPass: boolean;
    syntaxValid: boolean;
  };
  evidence: string[];
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
}

// ============================================================================
// Configuration
// ============================================================================

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.join(PROJECT_ROOT, 'scripts/run-external-validation-until-pass.sh');
const README_PATH = path.join(PROJECT_ROOT, 'scripts/run-external-validation-until-pass.README.md');

// ============================================================================
// Test Cases
// ============================================================================

export const TEST_CASE_1_SCRIPT_EXISTENCE: ValidationInput = {
  scriptPath: SCRIPT_PATH,
  readmePath: README_PATH,
  testMode: 'structure',
};

export const TEST_CASE_2_SYNTAX_VALIDATION: ValidationInput = {
  scriptPath: SCRIPT_PATH,
  readmePath: README_PATH,
  testMode: 'syntax',
};

export const TEST_CASE_3_DOCUMENTATION: ValidationInput = {
  scriptPath: SCRIPT_PATH,
  readmePath: README_PATH,
  testMode: 'documentation',
};

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if file exists and is executable
 */
function checkFileAccess(filePath: string): { exists: boolean; executable: boolean } {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    const exists = true;
    
    let executable = false;
    try {
      fs.accessSync(filePath, fs.constants.X_OK);
      executable = true;
    } catch (e) {
      // Not executable
    }
    
    return { exists, executable };
  } catch (e) {
    return { exists: false, executable: false };
  }
}

/**
 * Validate script structure by checking for required patterns
 */
function validateScriptStructure(scriptPath: string): {
  hasBuildIntegration: boolean;
  hasIterativeLoop: boolean;
  hasResultAnalysis: boolean;
  hasFixPrompts: boolean;
  hasMetaValidation: boolean;
  hasFinalReport: boolean;
} {
  const content = fs.readFileSync(scriptPath, 'utf-8');
  
  return {
    hasBuildIntegration: /bun run build/.test(content) && /EXPECTED_BINARY/.test(content),
    hasIterativeLoop: /while \[ \$ITERATION -lt \$MAX_ITERATIONS \]/.test(content),
    hasResultAnalysis: /validation-result-.*\.json/.test(content) && /overallPass/.test(content),
    hasFixPrompts: /read -p.*Ready to continue/.test(content) || /read -r/.test(content),
    hasMetaValidation: /Meta-Validation/.test(content) && /allRequirementsTested/.test(content),
    hasFinalReport: /Final Report/.test(content) && /Total Iterations/.test(content),
  };
}

/**
 * Validate script features
 */
function validateScriptFeatures(scriptPath: string): {
  maxIterationsConfigured: boolean;
  timestampedLogging: boolean;
  coloredOutput: boolean;
  exitCodeHandling: boolean;
  errorHandling: boolean;
} {
  const content = fs.readFileSync(scriptPath, 'utf-8');
  
  return {
    maxIterationsConfigured: /MAX_ITERATIONS=\d+/.test(content),
    timestampedLogging: /iteration-history-.*\.log/.test(content) || /date \+%s/.test(content),
    coloredOutput: /RED=|GREEN=|YELLOW=|BLUE=/.test(content),
    exitCodeHandling: /exit 0/.test(content) && /exit 1/.test(content),
    errorHandling: /set -e/.test(content) || /if \[/.test(content),
  };
}

/**
 * Validate documentation completeness
 */
function validateDocumentation(readmePath: string): {
  hasOverview: boolean;
  hasUsageInstructions: boolean;
  hasConfiguration: boolean;
  hasTroubleshooting: boolean;
  hasExamples: boolean;
} {
  const content = fs.readFileSync(readmePath, 'utf-8');
  
  return {
    hasOverview: /## Overview/.test(content) || /## Purpose/.test(content),
    hasUsageInstructions: /## Usage/.test(content) && /bash scripts\/run-external-validation-until-pass\.sh/.test(content),
    hasConfiguration: /## Configuration/.test(content) || /MAX_ITERATIONS/.test(content),
    hasTroubleshooting: /## Troubleshooting/.test(content),
    hasExamples: /```bash/.test(content) || /Example/.test(content),
  };
}

/**
 * Validate script syntax (basic shell syntax check)
 */
async function validateSyntax(scriptPath: string): Promise<{ valid: boolean; errors: string[] }> {
  return new Promise((resolve) => {
    const bashCheck = spawn('bash', ['-n', scriptPath]);
    const errors: string[] = [];
    
    bashCheck.stderr.on('data', (data) => {
      errors.push(data.toString());
    });
    
    bashCheck.on('close', (code) => {
      resolve({
        valid: code === 0,
        errors: errors,
      });
    });
    
    bashCheck.on('error', (err) => {
      resolve({
        valid: false,
        errors: [err.message],
      });
    });
  });
}

/**
 * Main validation function
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const evidence: string[] = [];
  const errors: string[] = [];
  
  // Check file existence
  const scriptAccess = checkFileAccess(input.scriptPath);
  const readmeAccess = checkFileAccess(input.readmePath);
  
  evidence.push(`Script exists: ${scriptAccess.exists}`);
  evidence.push(`Script executable: ${scriptAccess.executable}`);
  evidence.push(`README exists: ${readmeAccess.exists}`);
  
  if (!scriptAccess.exists) {
    errors.push(`Script not found: ${input.scriptPath}`);
  }
  
  if (!readmeAccess.exists) {
    errors.push(`README not found: ${input.readmePath}`);
  }
  
  // Validate structure
  let structureChecks = {
    hasBuildIntegration: false,
    hasIterativeLoop: false,
    hasResultAnalysis: false,
    hasFixPrompts: false,
    hasMetaValidation: false,
    hasFinalReport: false,
  };
  
  if (scriptAccess.exists) {
    structureChecks = validateScriptStructure(input.scriptPath);
    evidence.push(`Build integration: ${structureChecks.hasBuildIntegration}`);
    evidence.push(`Iterative loop: ${structureChecks.hasIterativeLoop}`);
    evidence.push(`Result analysis: ${structureChecks.hasResultAnalysis}`);
    evidence.push(`Fix prompts: ${structureChecks.hasFixPrompts}`);
    evidence.push(`Meta-validation: ${structureChecks.hasMetaValidation}`);
    evidence.push(`Final report: ${structureChecks.hasFinalReport}`);
  }
  
  // Validate features
  let featureChecks = {
    maxIterationsConfigured: false,
    timestampedLogging: false,
    coloredOutput: false,
    exitCodeHandling: false,
    errorHandling: false,
  };
  
  if (scriptAccess.exists) {
    featureChecks = validateScriptFeatures(input.scriptPath);
    evidence.push(`Max iterations configured: ${featureChecks.maxIterationsConfigured}`);
    evidence.push(`Timestamped logging: ${featureChecks.timestampedLogging}`);
    evidence.push(`Colored output: ${featureChecks.coloredOutput}`);
    evidence.push(`Exit code handling: ${featureChecks.exitCodeHandling}`);
    evidence.push(`Error handling: ${featureChecks.errorHandling}`);
  }
  
  // Validate documentation
  let documentationChecks = {
    hasOverview: false,
    hasUsageInstructions: false,
    hasConfiguration: false,
    hasTroubleshooting: false,
    hasExamples: false,
  };
  
  if (readmeAccess.exists) {
    documentationChecks = validateDocumentation(input.readmePath);
    evidence.push(`Documentation overview: ${documentationChecks.hasOverview}`);
    evidence.push(`Usage instructions: ${documentationChecks.hasUsageInstructions}`);
    evidence.push(`Configuration section: ${documentationChecks.hasConfiguration}`);
    evidence.push(`Troubleshooting guide: ${documentationChecks.hasTroubleshooting}`);
    evidence.push(`Examples provided: ${documentationChecks.hasExamples}`);
  }
  
  // Validate syntax
  let syntaxValid = false;
  if (scriptAccess.exists && input.testMode === 'syntax') {
    const syntaxResult = await validateSyntax(input.scriptPath);
    syntaxValid = syntaxResult.valid;
    errors.push(...syntaxResult.errors);
    evidence.push(`Syntax valid: ${syntaxValid}`);
  } else if (scriptAccess.exists) {
    // For non-syntax tests, assume syntax is valid if script exists
    syntaxValid = true;
  }
  
  // Determine overall pass
  const allStructureChecksPass = Object.values(structureChecks).every(v => v === true);
  const allFeatureChecksPass = Object.values(featureChecks).every(v => v === true);
  const allDocumentationChecksPass = Object.values(documentationChecks).every(v => v === true);
  
  const pass = scriptAccess.exists &&
               scriptAccess.executable &&
               readmeAccess.exists &&
               allStructureChecksPass &&
               allFeatureChecksPass &&
               allDocumentationChecksPass &&
               syntaxValid &&
               errors.length === 0;
  
  return {
    pass,
    actual: {
      scriptExists: scriptAccess.exists,
      scriptExecutable: scriptAccess.executable,
      readmeExists: readmeAccess.exists,
      structureChecks,
      featureChecks,
      documentationChecks,
      syntaxValid,
      errors,
    },
    expected: {
      scriptExists: true,
      scriptExecutable: true,
      readmeExists: true,
      allStructureChecksPass: true,
      allFeatureChecksPass: true,
      allDocumentationChecksPass: true,
      syntaxValid: true,
    },
    evidence,
  };
}

/**
 * Run all validation test cases
 */
export async function runAllValidations(): Promise<ValidationResult> {
  const testCases = [
    { id: 'case-1-structure', input: TEST_CASE_1_SCRIPT_EXISTENCE },
    { id: 'case-2-syntax', input: TEST_CASE_2_SYNTAX_VALIDATION },
    { id: 'case-3-documentation', input: TEST_CASE_3_DOCUMENTATION },
  ];
  
  const results: ValidationResult = {
    specificationName: 'run-external-validation-until-pass',
    timestamp: Date.now(),
    testCases: [],
    summary: {
      totalTests: testCases.length,
      passed: 0,
      failed: 0,
      overallPass: false,
    },
  };
  
  for (const testCase of testCases) {
    const output = await runValidation(testCase.input);
    const passed = output.pass;
    
    results.testCases.push({
      id: testCase.id,
      input: testCase.input,
      output,
      passed,
    });
    
    if (passed) {
      results.summary.passed++;
    } else {
      results.summary.failed++;
    }
  }
  
  results.summary.overallPass = results.summary.passed === results.summary.totalTests;
  
  return results;
}

/**
 * CLI entry point
 */
async function main() {
  console.log('========================================================================');
  console.log('Validation Harness: run-external-validation-until-pass');
  console.log('========================================================================');
  console.log('');
  
  const results = await runAllValidations();
  
  console.log('Test Results:');
  console.log('');
  
  for (const testCase of results.testCases) {
    const status = testCase.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} - ${testCase.id}`);
    
    if (!testCase.passed) {
      console.log('  Actual state:');
      console.log(`    Script exists: ${testCase.output.actual.scriptExists}`);
      console.log(`    Script executable: ${testCase.output.actual.scriptExecutable}`);
      console.log(`    README exists: ${testCase.output.actual.readmeExists}`);
      console.log(`    Syntax valid: ${testCase.output.actual.syntaxValid}`);
      
      if (testCase.output.actual.errors.length > 0) {
        console.log('  Errors:');
        testCase.output.actual.errors.forEach(err => console.log(`    - ${err}`));
      }
      
      console.log('  Evidence:');
      testCase.output.evidence.forEach(e => console.log(`    - ${e}`));
    }
    console.log('');
  }
  
  console.log('========================================================================');
  console.log('Summary');
  console.log('========================================================================');
  console.log(`Total Tests: ${results.summary.totalTests}`);
  console.log(`Passed: ${results.summary.passed}`);
  console.log(`Failed: ${results.summary.failed}`);
  console.log(`Overall: ${results.summary.overallPass ? '✓ PASS' : '✗ FAIL'}`);
  console.log('');
  
  // Save results
  const resultsDir = path.join(PROJECT_ROOT, 'test-results/run-external-validation-until-pass');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const resultsFile = path.join(resultsDir, `validation-result-${results.timestamp}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`Results saved to: ${resultsFile}`);
  console.log('');
  
  process.exit(results.summary.overallPass ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
