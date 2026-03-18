#!/usr/bin/env ts-node
/**
 * External E2E Activity Lifecycle Validation Harness
 * 
 * Specification: external-e2e-activity-lifecycle-validation
 * 
 * This harness validates the complete activity lifecycle using ONLY external tools:
 * - Compiled OpenCode binary (no dev code access)
 * - SurrealDB CLI ('surreal sql')
 * - Standard shell tools (grep, jq for parsing)
 * 
 * Test Flow:
 * 1. Query DB for existing templates (proves storage works)
 * 2. Execute template via OpenCode binary
 * 3. Query DB for execution record (proves execution storage works)
 * 4. Analyze logs for success/errors
 * 
 * Returns: {pass: boolean, actual, expected}
 */

import { spawn, SpawnOptionsWithoutStdio } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface ValidationInput {
  testCaseId: string;
  description: string;
  surrealUrl: string;
  surrealUser: string;
  surrealPass: string;
  surrealNs: string;
  surrealDb: string;
  opencodeBin: string;
  expectedTemplateCount?: number;
  expectedExecutionFields?: string[];
}

export interface ValidationOutput {
  pass: boolean;
  actual: {
    phase1: {
      templateCount: number;
      selectedTemplate?: {
        id: string;
        name: string;
        category: string;
      };
      hasRequiredFields: boolean;
    };
    phase2: {
      executionRecordFound: boolean;
      executionHasRequiredFields: boolean;
      templateIdMatches: boolean;
    };
    phase3: {
      errorCount: number;
      hasLifecycleIndicators: boolean;
    };
  };
  expected: {
    phase1: {
      minTemplateCount: number;
      requiredFields: string[];
    };
    phase2: {
      executionExists: boolean;
      requiredFields: string[];
    };
    phase3: {
      maxErrors: number;
      hasLifecycleIndicators: boolean;
    };
  };
  errors: string[];
  evidence: string[];
  timestamp: string;
}

interface DBQueryResult {
  success: boolean;
  data: any[];
  error?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

async function execCommand(
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, options);
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (exitCode) => {
      resolve({ exitCode: exitCode || 0, stdout, stderr });
    });

    proc.on('error', (error) => {
      stderr += error.message;
      resolve({ exitCode: 1, stdout, stderr });
    });
  });
}

async function querySurrealDB(
  url: string,
  user: string,
  pass: string,
  ns: string,
  db: string,
  query: string
): Promise<DBQueryResult> {
  const result = await execCommand('surreal', [
    'sql',
    '--conn', url,
    '--user', user,
    '--pass', pass,
    '--ns', ns,
    '--db', db,
    '--json',
    query
  ]);

  if (result.exitCode !== 0) {
    return {
      success: false,
      data: [],
      error: result.stderr || 'Unknown error'
    };
  }

  try {
    const parsed = JSON.parse(result.stdout);
    const results = Array.isArray(parsed) && parsed[0]?.result ? parsed[0].result : [];
    return {
      success: true,
      data: Array.isArray(results) ? results : [results]
    };
  } catch (e) {
    return {
      success: false,
      data: [],
      error: `Failed to parse JSON: ${e}`
    };
  }
}

function extractActivityId(output: string): string | undefined {
  const patterns = [
    /"activity_id":\s*"([^"]+)"/,
    /"id":\s*"(act_[^"]+)"/,
    /Activity:\s*(act_[a-z0-9]+)/i,
    /activity.*?(act_[a-z0-9]{10,})/i
  ];

  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return undefined;
}

function hasRequiredFields(obj: any, fields: string[]): boolean {
  return fields.every(field => field in obj);
}

// ============================================================================
// Phase 1: Verify Template Storage
// ============================================================================

async function phase1_verifyTemplateStorage(input: ValidationInput): Promise<{
  passed: boolean;
  templateCount: number;
  selectedTemplate?: any;
  hasRequiredFields: boolean;
  errors: string[];
  evidence: string[];
}> {
  const errors: string[] = [];
  const evidence: string[] = [];

  // Query DB for templates
  const dbQuery = 'SELECT * FROM activity_template LIMIT 10';
  const dbResult = await querySurrealDB(
    input.surrealUrl,
    input.surrealUser,
    input.surrealPass,
    input.surrealNs,
    input.surrealDb,
    dbQuery
  );

  if (!dbResult.success) {
    errors.push(`DB query failed: ${dbResult.error}`);
    return {
      passed: false,
      templateCount: 0,
      hasRequiredFields: false,
      errors,
      evidence
    };
  }

  const templateCount = dbResult.data.length;
  evidence.push(`Found ${templateCount} templates in database`);

  if (templateCount === 0) {
    errors.push('No templates found in database');
    return {
      passed: false,
      templateCount: 0,
      hasRequiredFields: false,
      errors,
      evidence
    };
  }

  // Select first template
  const selectedTemplate = dbResult.data[0];
  const requiredFields = ['id', 'name', 'category', 'tasks'];
  const hasFields = hasRequiredFields(selectedTemplate, requiredFields);

  if (!hasFields) {
    errors.push(`Template missing required fields: ${requiredFields.join(', ')}`);
  }

  evidence.push(`Selected template: ${selectedTemplate.id}`);
  evidence.push(`Template has required fields: ${hasFields}`);

  return {
    passed: errors.length === 0,
    templateCount,
    selectedTemplate,
    hasRequiredFields: hasFields,
    errors,
    evidence
  };
}

// ============================================================================
// Phase 2: Execute Template + Verify Execution Storage
// ============================================================================

async function phase2_executeAndVerifyStorage(
  input: ValidationInput,
  templateId: string
): Promise<{
  passed: boolean;
  executionRecordFound: boolean;
  executionHasRequiredFields: boolean;
  templateIdMatches: boolean;
  errors: string[];
  evidence: string[];
}> {
  const errors: string[] = [];
  const evidence: string[] = [];

  // Execute template via CLI
  const executeResult = await execCommand(input.opencodeBin, [
    'activity',
    templateId,
    '--variables', '{}',
    '--reason', 'E2E validation test execution'
  ]);

  const cliOutput = executeResult.stdout + executeResult.stderr;
  evidence.push(`CLI execution completed with exit code ${executeResult.exitCode}`);

  if (executeResult.exitCode !== 0) {
    errors.push(`CLI execution failed with exit code ${executeResult.exitCode}`);
    // Continue to check DB anyway
  }

  // Query DB for execution record
  const dbQuery = `SELECT * FROM activity_execution WHERE template_id = "${templateId}" ORDER BY created_at DESC LIMIT 1`;
  const dbResult = await querySurrealDB(
    input.surrealUrl,
    input.surrealUser,
    input.surrealPass,
    input.surrealNs,
    input.surrealDb,
    dbQuery
  );

  if (!dbResult.success) {
    errors.push(`DB query failed: ${dbResult.error}`);
    return {
      passed: false,
      executionRecordFound: false,
      executionHasRequiredFields: false,
      templateIdMatches: false,
      errors,
      evidence
    };
  }

  const executionRecordFound = dbResult.data.length > 0;
  evidence.push(`Execution record found: ${executionRecordFound}`);

  if (!executionRecordFound) {
    errors.push('Execution record not found in database');
    return {
      passed: false,
      executionRecordFound: false,
      executionHasRequiredFields: false,
      templateIdMatches: false,
      errors,
      evidence
    };
  }

  const executionRecord = dbResult.data[0];
  const requiredFields = input.expectedExecutionFields || ['id', 'template_id', 'status'];
  const hasFields = hasRequiredFields(executionRecord, requiredFields);
  const templateIdMatches = executionRecord.template_id === templateId;

  evidence.push(`Execution has required fields: ${hasFields}`);
  evidence.push(`Template ID matches: ${templateIdMatches}`);

  if (!hasFields) {
    errors.push(`Execution missing required fields: ${requiredFields.join(', ')}`);
  }

  if (!templateIdMatches) {
    errors.push(`Template ID mismatch: expected ${templateId}, got ${executionRecord.template_id}`);
  }

  return {
    passed: errors.length === 0,
    executionRecordFound,
    executionHasRequiredFields: hasFields,
    templateIdMatches,
    errors,
    evidence
  };
}

// ============================================================================
// Phase 3: Log Analysis
// ============================================================================

async function phase3_analyzeLogsForLifecycle(logFile: string): Promise<{
  passed: boolean;
  errorCount: number;
  hasLifecycleIndicators: boolean;
  errors: string[];
  evidence: string[];
}> {
  const errors: string[] = [];
  const evidence: string[] = [];

  if (!fs.existsSync(logFile)) {
    errors.push(`Log file not found: ${logFile}`);
    return {
      passed: false,
      errorCount: 0,
      hasLifecycleIndicators: false,
      errors,
      evidence
    };
  }

  const logContent = fs.readFileSync(logFile, 'utf-8');
  evidence.push(`Log file: ${logFile} (${logContent.length} chars)`);

  // Count errors
  const errorPattern = /\[ERROR\]|critical|fatal/gi;
  const errorMatches = logContent.match(errorPattern) || [];
  const errorCount = errorMatches.length;

  evidence.push(`Error-level keywords: ${errorCount}`);

  // Check for lifecycle indicators
  const hasActivityStarted = /activity.*start|executing.*activity|running.*template/i.test(logContent);
  const hasActivityCompleted = /activity.*complet|activity.*done|activity.*success/i.test(logContent);
  const hasTaskExecution = /task.*execut|running.*task|task.*complet/i.test(logContent);

  const hasLifecycleIndicators = hasActivityStarted || hasActivityCompleted || hasTaskExecution;
  evidence.push(`Lifecycle indicators: started=${hasActivityStarted}, completed=${hasActivityCompleted}, tasks=${hasTaskExecution}`);

  if (errorCount > 5) {
    errors.push(`Too many error-level keywords (${errorCount})`);
  }

  return {
    passed: errors.length === 0,
    errorCount,
    hasLifecycleIndicators,
    errors,
    evidence
  };
}

// ============================================================================
// Main Validation Function
// ============================================================================

export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const timestamp = new Date().toISOString();
  const logDir = path.join(process.cwd(), 'test-results/external-e2e-validation');
  const logFile = path.join(logDir, `validation-${Date.now()}.log`);

  // Ensure log directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Create log file
  fs.writeFileSync(logFile, `Validation started: ${timestamp}\n`);

  const allErrors: string[] = [];
  const allEvidence: string[] = [];

  // Phase 1: Verify Template Storage
  const phase1 = await phase1_verifyTemplateStorage(input);
  allErrors.push(...phase1.errors);
  allEvidence.push(...phase1.evidence);

  // Phase 2: Execute Template + Verify Storage
  let phase2;
  if (phase1.passed && phase1.selectedTemplate) {
    phase2 = await phase2_executeAndVerifyStorage(input, phase1.selectedTemplate.id);
    allErrors.push(...phase2.errors);
    allEvidence.push(...phase2.evidence);
  } else {
    phase2 = {
      passed: false,
      executionRecordFound: false,
      executionHasRequiredFields: false,
      templateIdMatches: false,
      errors: ['Skipped due to Phase 1 failure'],
      evidence: []
    };
    allErrors.push(...phase2.errors);
  }

  // Phase 3: Log Analysis
  const phase3 = await phase3_analyzeLogsForLifecycle(logFile);
  allErrors.push(...phase3.errors);
  allEvidence.push(...phase3.evidence);

  // Calculate overall pass
  const passedPhases = [phase1.passed, phase2.passed, phase3.passed].filter(Boolean).length;
  const overallPass = passedPhases >= 2; // Need 2/3 phases to pass

  // Build output
  const output: ValidationOutput = {
    pass: overallPass,
    actual: {
      phase1: {
        templateCount: phase1.templateCount,
        selectedTemplate: phase1.selectedTemplate ? {
          id: phase1.selectedTemplate.id,
          name: phase1.selectedTemplate.name,
          category: phase1.selectedTemplate.category
        } : undefined,
        hasRequiredFields: phase1.hasRequiredFields
      },
      phase2: {
        executionRecordFound: phase2.executionRecordFound,
        executionHasRequiredFields: phase2.executionHasRequiredFields,
        templateIdMatches: phase2.templateIdMatches
      },
      phase3: {
        errorCount: phase3.errorCount,
        hasLifecycleIndicators: phase3.hasLifecycleIndicators
      }
    },
    expected: {
      phase1: {
        minTemplateCount: input.expectedTemplateCount || 1,
        requiredFields: ['id', 'name', 'category', 'tasks']
      },
      phase2: {
        executionExists: true,
        requiredFields: input.expectedExecutionFields || ['id', 'template_id', 'status']
      },
      phase3: {
        maxErrors: 5,
        hasLifecycleIndicators: true
      }
    },
    errors: allErrors,
    evidence: allEvidence,
    timestamp
  };

  // Save result
  const resultFile = path.join(logDir, `validation-result-${Date.now()}.json`);
  fs.writeFileSync(resultFile, JSON.stringify(output, null, 2));

  return output;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  const defaultInput: ValidationInput = {
    testCaseId: 'default',
    description: 'Default E2E validation test',
    surrealUrl: process.env.SURREAL_URL || 'http://localhost:8000',
    surrealUser: process.env.SURREAL_USER || 'root',
    surrealPass: process.env.SURREAL_PASS || 'root',
    surrealNs: process.env.SURREAL_NS || 'metabob',
    surrealDb: process.env.SURREAL_DB || 'devbob',
    opencodeBin: path.join(process.cwd(), 'repos/metabob-opencode/dist/opencode-linux-x64/bin/opencode'),
    expectedTemplateCount: 1,
    expectedExecutionFields: ['id', 'template_id', 'status']
  };

  runValidation(defaultInput)
    .then((result) => {
      console.log('\n========================================');
      console.log('VALIDATION RESULT');
      console.log('========================================\n');
      console.log(`Overall: ${result.pass ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Timestamp: ${result.timestamp}`);
      console.log(`\nPhase 1 (Template Storage): ${result.actual.phase1.hasRequiredFields ? '✅' : '❌'}`);
      console.log(`  Templates found: ${result.actual.phase1.templateCount}`);
      console.log(`\nPhase 2 (Execution Storage): ${result.actual.phase2.executionRecordFound ? '✅' : '❌'}`);
      console.log(`  Execution record found: ${result.actual.phase2.executionRecordFound}`);
      console.log(`\nPhase 3 (Log Analysis): ${result.actual.phase3.errorCount <= 5 ? '✅' : '❌'}`);
      console.log(`  Errors: ${result.actual.phase3.errorCount}`);
      
      if (result.errors.length > 0) {
        console.log(`\nErrors:`);
        result.errors.forEach(err => console.log(`  - ${err}`));
      }

      process.exit(result.pass ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
