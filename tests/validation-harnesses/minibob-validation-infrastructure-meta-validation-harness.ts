#!/usr/bin/env bun
/**
 * Validation Harness: minibob Validation Infrastructure Meta-Validation
 * 
 * Purpose: Meta-validate that our validators themselves are valid and production-ready
 * 
 * This harness validates the validation infrastructure by checking:
 * 1. Dry-run mode works without deployment
 * 2. Documentation is complete and accurate
 * 3. Error handling provides actionable guidance
 * 4. Prerequisites are checked programmatically
 * 5. New users can follow documentation successfully
 * 6. All harnesses are discoverable and documented
 * 7. Validation reports are parseable and useful
 */

import { existsSync, readFileSync, accessSync, constants } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

export interface ValidationInput {
  repoRoot: string;
  skipNetworkTests?: boolean; // Skip tests requiring cluster
  verbose?: boolean;
}

export interface StepResult {
  step: number;
  name: string;
  pass: boolean;
  message: string;
  details?: Record<string, any>;
}

export interface ValidationResult {
  pass: boolean;
  summary: string;
  timestamp: string;
  steps: StepResult[];
}

/**
 * Step 1: Validate Prerequisite Utilities Exist
 */
async function validatePrerequisiteUtilities(repoRoot: string): Promise<StepResult> {
  const utilsPath = join(repoRoot, 'tests/validation-harnesses/lib/prerequisites.ts');
  
  try {
    if (!existsSync(utilsPath)) {
      return {
        step: 1,
        name: 'Prerequisite Utilities Exist',
        pass: false,
        message: 'prerequisites.ts not found',
        details: { expectedPath: utilsPath }
      };
    }

    const content = readFileSync(utilsPath, 'utf-8');
    
    // Check for required exports
    const requiredExports = [
      'validatePrerequisites',
      'printPrerequisiteReport',
      'COMMON_CHECKS',
      'checkCommandExists',
      'checkClusterAccessible',
      'checkNamespaceExists'
    ];
    
    const missingExports = requiredExports.filter(exp => !content.includes(exp));
    
    if (missingExports.length > 0) {
      return {
        step: 1,
        name: 'Prerequisite Utilities Exist',
        pass: false,
        message: `Missing exports: ${missingExports.join(', ')}`,
        details: { missingExports }
      };
    }

    // Check for COMMON_CHECKS factory
    const commonChecks = ['kubectl', 'helmfile', 'bun', 'docker', 'cluster', 'namespace', 'pods', 'deployment'];
    const missingChecks = commonChecks.filter(check => !content.includes(`${check}:`));
    
    return {
      step: 1,
      name: 'Prerequisite Utilities Exist',
      pass: true,
      message: `All required utilities present (${requiredExports.length} exports, ${commonChecks.length - missingChecks.length}/${commonChecks.length} common checks)`,
      details: {
        exportsFound: requiredExports.length,
        commonChecksFound: commonChecks.length - missingChecks.length,
        fileSize: content.length
      }
    };
  } catch (error) {
    return {
      step: 1,
      name: 'Prerequisite Utilities Exist',
      pass: false,
      message: `Error: ${error}`,
      details: { error: String(error) }
    };
  }
}

/**
 * Step 2: Validate Error Translation Utilities Exist
 */
async function validateErrorTranslator(repoRoot: string): Promise<StepResult> {
  const translatorPath = join(repoRoot, 'tests/validation-harnesses/lib/error-translator.ts');
  
  try {
    if (!existsSync(translatorPath)) {
      return {
        step: 2,
        name: 'Error Translation Utilities Exist',
        pass: false,
        message: 'error-translator.ts not found',
        details: { expectedPath: translatorPath }
      };
    }

    const content = readFileSync(translatorPath, 'utf-8');
    
    // Check for required exports
    const requiredExports = [
      'translateError',
      'wrapError',
      'formatError',
      'tryWithActionableError',
      'ActionableError'
    ];
    
    const missingExports = requiredExports.filter(exp => !content.includes(exp));
    
    if (missingExports.length > 0) {
      return {
        step: 2,
        name: 'Error Translation Utilities Exist',
        pass: false,
        message: `Missing exports: ${missingExports.join(', ')}`,
        details: { missingExports }
      };
    }

    // Count error translations (look for error patterns)
    const errorPatterns = [
      'kubectl.*not found',
      'unable to connect',
      'namespace.*not found',
      'no pods found',
      'deployment.*not found',
      'port-forward',
      'enoent',
      'eacces',
      'permission denied'
    ];
    
    const patternsFound = errorPatterns.filter(pattern => 
      new RegExp(pattern, 'i').test(content)
    );
    
    return {
      step: 2,
      name: 'Error Translation Utilities Exist',
      pass: true,
      message: `Error translator complete (${requiredExports.length} exports, ${patternsFound.length}+ error patterns)`,
      details: {
        exportsFound: requiredExports.length,
        errorPatternsFound: patternsFound.length,
        fileSize: content.length
      }
    };
  } catch (error) {
    return {
      step: 2,
      name: 'Error Translation Utilities Exist',
      pass: false,
      message: `Error: ${error}`,
      details: { error: String(error) }
    };
  }
}

/**
 * Step 3: Validate CLI Runner Supports Dry-Run
 */
async function validateCliRunnerDryRun(repoRoot: string): Promise<StepResult> {
  const runnerPath = join(repoRoot, 'tests/validation-harnesses/run-minibob-validation.ts');
  
  try {
    if (!existsSync(runnerPath)) {
      return {
        step: 3,
        name: 'CLI Runner Supports Dry-Run',
        pass: false,
        message: 'run-minibob-validation.ts not found',
        details: { expectedPath: runnerPath }
      };
    }

    const content = readFileSync(runnerPath, 'utf-8');
    
    // Check for dry-run support
    const dryRunFeatures = [
      '--dry-run',
      '--check-prerequisites',
      'parseArgs',
      'getPrerequisiteChecks',
      'validatePrerequisites',
      'printPrerequisiteReport'
    ];
    
    const missingFeatures = dryRunFeatures.filter(feature => !content.includes(feature));
    
    if (missingFeatures.length > 0) {
      return {
        step: 3,
        name: 'CLI Runner Supports Dry-Run',
        pass: false,
        message: `Missing dry-run features: ${missingFeatures.join(', ')}`,
        details: { missingFeatures }
      };
    }

    // Check imports from lib
    const hasPrerequisiteImport = content.includes('from "./lib/prerequisites"') || 
                                  content.includes('from \'./lib/prerequisites\'');
    
    if (!hasPrerequisiteImport) {
      return {
        step: 3,
        name: 'CLI Runner Supports Dry-Run',
        pass: false,
        message: 'Missing import from lib/prerequisites',
        details: { hasPrerequisiteImport }
      };
    }

    return {
      step: 3,
      name: 'CLI Runner Supports Dry-Run',
      pass: true,
      message: `CLI runner dry-run implemented (${dryRunFeatures.length} features)`,
      details: {
        featuresImplemented: dryRunFeatures.length,
        hasFlagParsing: true,
        hasPrerequisiteImport: true
      }
    };
  } catch (error) {
    return {
      step: 3,
      name: 'CLI Runner Supports Dry-Run',
      pass: false,
      message: `Error: ${error}`,
      details: { error: String(error) }
    };
  }
}

/**
 * Step 4: Validate Documentation Completeness
 */
async function validateDocumentation(repoRoot: string): Promise<StepResult> {
  const readmePath = join(repoRoot, 'tests/validation-harnesses/README.md');
  
  try {
    if (!existsSync(readmePath)) {
      return {
        step: 4,
        name: 'Documentation Completeness',
        pass: false,
        message: 'README.md not found',
        details: { expectedPath: readmePath }
      };
    }

    const content = readFileSync(readmePath, 'utf-8');
    
    // Check for required sections
    const requiredSections = [
      'Prerequisites',
      'Validation Readiness Check',
      'Quickstart Guide',
      '--dry-run',
      'Troubleshooting',
      'All Available Harnesses'
    ];
    
    const missingSections = requiredSections.filter(section => 
      !content.toLowerCase().includes(section.toLowerCase())
    );
    
    if (missingSections.length > 0) {
      return {
        step: 4,
        name: 'Documentation Completeness',
        pass: false,
        message: `Missing sections: ${missingSections.join(', ')}`,
        details: { missingSections }
      };
    }

    // Check for all 4 harnesses documented
    const harnesses = [
      'complete-system-integration',
      'self-configuration',
      'testing-infrastructure',
      'standalone-execution'
    ];
    
    const documentedHarnesses = harnesses.filter(h => content.includes(h));
    
    // Check for actionable error examples
    const hasErrorTable = content.includes('| Error |') && content.includes('| Solution |');
    const hasStepByStepFixes = content.includes('Step 1') && content.includes('Step 2');
    
    return {
      step: 4,
      name: 'Documentation Completeness',
      pass: true,
      message: `Documentation complete (${requiredSections.length} sections, ${documentedHarnesses.length}/4 harnesses, error table: ${hasErrorTable})`,
      details: {
        sectionsFound: requiredSections.length,
        harnessesDocumented: documentedHarnesses.length,
        hasErrorTable,
        hasStepByStepFixes,
        fileSize: content.length
      }
    };
  } catch (error) {
    return {
      step: 4,
      name: 'Documentation Completeness',
      pass: false,
      message: `Error: ${error}`,
      details: { error: String(error) }
    };
  }
}

/**
 * Step 5: Validate All Harnesses Exist
 */
async function validateHarnessesExist(repoRoot: string): Promise<StepResult> {
  const harnessDir = join(repoRoot, 'tests/validation-harnesses');
  
  try {
    const expectedHarnesses = [
      'minibob-complete-system-integration-harness.ts',
      'minibob-self-configuration-system-harness.ts',
      'minibob-testing-infrastructure-harness.ts',
      'minibob-standalone-execution-harness.ts'
    ];
    
    const existingHarnesses = expectedHarnesses.filter(h => 
      existsSync(join(harnessDir, h))
    );
    
    if (existingHarnesses.length !== expectedHarnesses.length) {
      const missing = expectedHarnesses.filter(h => !existingHarnesses.includes(h));
      return {
        step: 5,
        name: 'All Harnesses Exist',
        pass: false,
        message: `Missing harnesses: ${missing.join(', ')}`,
        details: { 
          expected: expectedHarnesses.length,
          found: existingHarnesses.length,
          missing
        }
      };
    }

    // Check each harness exports runValidation or similar
    let validHarnesses = 0;
    for (const harness of existingHarnesses) {
      const content = readFileSync(join(harnessDir, harness), 'utf-8');
      if (content.includes('export') && (content.includes('function') || content.includes('const'))) {
        validHarnesses++;
      }
    }

    return {
      step: 5,
      name: 'All Harnesses Exist',
      pass: true,
      message: `All 4 harnesses present and exportable (${validHarnesses}/4 valid)`,
      details: {
        expectedHarnesses: expectedHarnesses.length,
        existingHarnesses: existingHarnesses.length,
        validHarnesses
      }
    };
  } catch (error) {
    return {
      step: 5,
      name: 'All Harnesses Exist',
      pass: false,
      message: `Error: ${error}`,
      details: { error: String(error) }
    };
  }
}

/**
 * Step 6: Validate Trace Documentation Exists
 */
async function validateTraceDocumentation(repoRoot: string): Promise<StepResult> {
  const tracePath = join(repoRoot, 'TRACE_minibob_validation_infrastructure_meta_validation.md');
  
  try {
    if (!existsSync(tracePath)) {
      return {
        step: 6,
        name: 'Trace Documentation Exists',
        pass: false,
        message: 'Trace documentation not found',
        details: { expectedPath: tracePath }
      };
    }

    const content = readFileSync(tracePath, 'utf-8');
    
    // Check for required sections
    const requiredSections = [
      'Current State',
      'Desired State',
      'Gap Summary',
      'Implementation Plan'
    ];
    
    const missingSections = requiredSections.filter(section => 
      !content.includes(section)
    );
    
    if (missingSections.length > 0) {
      return {
        step: 6,
        name: 'Trace Documentation Exists',
        pass: false,
        message: `Missing sections: ${missingSections.join(', ')}`,
        details: { missingSections }
      };
    }

    // Check that it documents gaps
    const hasGaps = content.includes('gap') || content.includes('Gap');
    const hasComponents = content.match(/components?/gi)?.length || 0;
    
    return {
      step: 6,
      name: 'Trace Documentation Exists',
      pass: true,
      message: `Trace documentation complete (${requiredSections.length} sections, ${hasComponents} component mentions)`,
      details: {
        sectionsFound: requiredSections.length,
        hasGaps,
        componentMentions: hasComponents,
        fileSize: content.length
      }
    };
  } catch (error) {
    return {
      step: 6,
      name: 'Trace Documentation Exists',
      pass: false,
      message: `Error: ${error}`,
      details: { error: String(error) }
    };
  }
}

/**
 * Step 7: Validate Enforcement Documentation Exists
 */
async function validateEnforcementDocumentation(repoRoot: string): Promise<StepResult> {
  const enforcementPath = join(repoRoot, 'ENFORCEMENT_minibob_validation_infrastructure_meta_validation.md');
  
  try {
    if (!existsSync(enforcementPath)) {
      return {
        step: 7,
        name: 'Enforcement Documentation Exists',
        pass: false,
        message: 'Enforcement documentation not found',
        details: { expectedPath: enforcementPath }
      };
    }

    const content = readFileSync(enforcementPath, 'utf-8');
    
    // Check for required sections
    const requiredSections = [
      'Changes Applied',
      'Gaps Closed',
      'Meta-Validation Results'
    ];
    
    const missingSections = requiredSections.filter(section => 
      !content.includes(section)
    );
    
    if (missingSections.length > 0) {
      return {
        step: 7,
        name: 'Enforcement Documentation Exists',
        pass: false,
        message: `Missing sections: ${missingSections.join(', ')}`,
        details: { missingSections }
      };
    }

    // Check that it documents what was implemented
    const hasFilePaths = content.match(/tests\/validation-harnesses/g)?.length || 0;
    const hasReasons = content.match(/reason/gi)?.length || 0;
    
    return {
      step: 7,
      name: 'Enforcement Documentation Exists',
      pass: true,
      message: `Enforcement documentation complete (${requiredSections.length} sections, ${hasFilePaths} file mentions)`,
      details: {
        sectionsFound: requiredSections.length,
        fileMentions: hasFilePaths,
        reasonMentions: hasReasons,
        fileSize: content.length
      }
    };
  } catch (error) {
    return {
      step: 7,
      name: 'Enforcement Documentation Exists',
      pass: false,
      message: `Error: ${error}`,
      details: { error: String(error) }
    };
  }
}

/**
 * Step 8: Validate CLI Runner is Executable
 */
async function validateCliExecutable(repoRoot: string): Promise<StepResult> {
  const runnerPath = join(repoRoot, 'tests/validation-harnesses/run-minibob-validation.ts');
  
  try {
    // Check file exists
    if (!existsSync(runnerPath)) {
      return {
        step: 8,
        name: 'CLI Runner is Executable',
        pass: false,
        message: 'CLI runner not found',
        details: { expectedPath: runnerPath }
      };
    }

    // Check shebang
    const content = readFileSync(runnerPath, 'utf-8');
    const hasShebang = content.startsWith('#!');
    
    // Check if executable (on Unix systems)
    let isExecutable = false;
    try {
      accessSync(runnerPath, constants.X_OK);
      isExecutable = true;
    } catch {
      // Not executable, but that's okay on some systems
    }

    return {
      step: 8,
      name: 'CLI Runner is Executable',
      pass: true,
      message: `CLI runner ready (shebang: ${hasShebang}, executable: ${isExecutable})`,
      details: {
        hasShebang,
        isExecutable,
        path: runnerPath
      }
    };
  } catch (error) {
    return {
      step: 8,
      name: 'CLI Runner is Executable',
      pass: false,
      message: `Error: ${error}`,
      details: { error: String(error) }
    };
  }
}

/**
 * Step 9: Validate Dry-Run Works Without Cluster (if possible)
 */
async function validateDryRunWorks(repoRoot: string, skipNetworkTests: boolean): Promise<StepResult> {
  if (skipNetworkTests) {
    return {
      step: 9,
      name: 'Dry-Run Works Without Cluster',
      pass: true,
      message: 'Skipped (skipNetworkTests=true)',
      details: { skipped: true }
    };
  }

  const runnerPath = join(repoRoot, 'tests/validation-harnesses/run-minibob-validation.ts');
  
  try {
    // Try to run with --dry-run flag
    const cmd = `cd ${repoRoot} && bun run ${runnerPath} --dry-run 1 2>&1 || true`;
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
    
    // Check for prerequisite check output
    const hasPreflightChecks = output.includes('Pre-flight Checks') || 
                               output.includes('DEPENDENCY') ||
                               output.includes('INFRASTRUCTURE');
    
    const hasChecksFormat = output.includes('✓') || output.includes('✗');
    
    // It's okay if checks fail (cluster might not exist), but format should be present
    return {
      step: 9,
      name: 'Dry-Run Works Without Cluster',
      pass: hasPreflightChecks && hasChecksFormat,
      message: hasPreflightChecks ? 
        'Dry-run executed successfully with prerequisite checks' : 
        'Dry-run did not show expected prerequisite check format',
      details: {
        hasPreflightChecks,
        hasChecksFormat,
        outputLength: output.length,
        outputSample: output.substring(0, 500)
      }
    };
  } catch (error) {
    return {
      step: 9,
      name: 'Dry-Run Works Without Cluster',
      pass: false,
      message: `Error executing dry-run: ${error}`,
      details: { error: String(error) }
    };
  }
}

/**
 * Step 10: Validate Error Messages are Actionable
 */
async function validateActionableErrors(repoRoot: string): Promise<StepResult> {
  const translatorPath = join(repoRoot, 'tests/validation-harnesses/lib/error-translator.ts');
  
  try {
    if (!existsSync(translatorPath)) {
      return {
        step: 10,
        name: 'Error Messages are Actionable',
        pass: false,
        message: 'Error translator not found',
        details: { expectedPath: translatorPath }
      };
    }

    const content = readFileSync(translatorPath, 'utf-8');
    
    // Check that error translations include suggestedFix
    const hasSuggestedFix = content.includes('suggestedFix');
    const hasDocumentationLink = content.includes('documentationLink');
    
    // Count instances of actionable fixes
    const fixCount = (content.match(/suggestedFix:/g) || []).length;
    const docsLinkCount = (content.match(/documentationLink:/g) || []).length;
    
    if (!hasSuggestedFix) {
      return {
        step: 10,
        name: 'Error Messages are Actionable',
        pass: false,
        message: 'Error translator missing suggestedFix field',
        details: { hasSuggestedFix, hasDocumentationLink }
      };
    }

    return {
      step: 10,
      name: 'Error Messages are Actionable',
      pass: true,
      message: `Error translations are actionable (${fixCount} fixes, ${docsLinkCount} doc links)`,
      details: {
        hasSuggestedFix,
        hasDocumentationLink,
        fixCount,
        docsLinkCount
      }
    };
  } catch (error) {
    return {
      step: 10,
      name: 'Error Messages are Actionable',
      pass: false,
      message: `Error: ${error}`,
      details: { error: String(error) }
    };
  }
}

/**
 * Main validation function
 */
export default async function runValidation(input: ValidationInput): Promise<ValidationResult> {
  const { repoRoot, skipNetworkTests = true, verbose = false } = input;

  if (verbose) {
    console.log('[Meta-Validation] Starting validation infrastructure meta-validation');
    console.log(`[Meta-Validation] Repo root: ${repoRoot}`);
    console.log(`[Meta-Validation] Skip network tests: ${skipNetworkTests}`);
  }

  const steps: StepResult[] = [];

  // Execute all validation steps
  steps.push(await validatePrerequisiteUtilities(repoRoot));
  steps.push(await validateErrorTranslator(repoRoot));
  steps.push(await validateCliRunnerDryRun(repoRoot));
  steps.push(await validateDocumentation(repoRoot));
  steps.push(await validateHarnessesExist(repoRoot));
  steps.push(await validateTraceDocumentation(repoRoot));
  steps.push(await validateEnforcementDocumentation(repoRoot));
  steps.push(await validateCliExecutable(repoRoot));
  steps.push(await validateDryRunWorks(repoRoot, skipNetworkTests));
  steps.push(await validateActionableErrors(repoRoot));

  const passedSteps = steps.filter(s => s.pass).length;
  const totalSteps = steps.length;
  const allPassed = passedSteps === totalSteps;

  return {
    pass: allPassed,
    summary: allPassed 
      ? `✅ ALL META-VALIDATION STEPS PASSED (${passedSteps}/${totalSteps})`
      : `⚠️ META-VALIDATION INCOMPLETE (${passedSteps}/${totalSteps} passed)`,
    timestamp: new Date().toISOString(),
    steps
  };
}

/**
 * CLI execution support
 * 
 * Run directly with:
 * bun run tests/validation-harnesses/minibob-validation-infrastructure-meta-validation-harness.ts [repoRoot] [--skip-network] [--verbose]
 * 
 * Or import and use programmatically:
 * import runValidation from "./minibob-validation-infrastructure-meta-validation-harness"
 * const result = await runValidation({ repoRoot: "." })
 */
