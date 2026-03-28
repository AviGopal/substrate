/**
 * Activity Lifecycle Logging Specification - Validation Harness
 * 
 * Purpose: Validate that all 8 lifecycle log patterns appear when executing
 *          an activity in a fresh process (DevBob pod or local binary).
 *
 * Specification: Activity Lifecycle Logging Specification
 *
 * Validation Strategy:
 *   1. Execute activity in fresh process using built binary
 *   2. Capture logs with --print-logs flag or kubectl logs
 *   3. Grep for all 8 log patterns
 *   4. Verify each appears at least once (or minOccurrences)
 *   5. Return PASS/FAIL (no LLM needed)
 *
 * Expected Patterns (8 total):
 *   1. Activity.*starting - Activity initialization
 *   2. Memory agent initializing - Context gathering start
 *   3. Memory agent gathered.*impulses - Context gathering complete
 *   4. Task starting: - Task execution start
 *   5. Task completed: - Task execution complete
 *   6. storage write confirmed - Storage persistence
 *   7. Git commit created: - Git operations (optional)
 *   8. Activity completed: - Activity completion
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import * as path from 'path';

/**
 * Pattern configuration for lifecycle logs
 */
interface PatternConfig {
  regex: string;
  description: string;
  minOccurrences: number;
  optional?: boolean;
  example: string;
}

/**
 * Validation input configuration
 */
export interface ValidationInput {
  // Execution method: 'kubectl' for DevBob pod, 'local' for local binary
  method: 'kubectl' | 'local';
  
  // For kubectl method
  pod?: string;
  namespace?: string;
  
  // For local method
  binaryPath?: string;
  printLogs?: boolean;
  
  // Activity to execute
  templateId: string;
  variables: Record<string, any>;
  reason: string;
  
  // Timeout in seconds
  timeout?: number;
}

/**
 * Pattern matching result
 */
interface PatternResult {
  pattern: string;
  regex: string;
  description: string;
  found: boolean;
  occurrences: number;
  minOccurrences: number;
  optional: boolean;
  pass: boolean;
  matches?: string[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  pass: boolean;
  timestamp: number;
  method: string;
  execution: {
    command: string;
    duration: number;
    exitCode: number;
    logLines: number;
  };
  patterns: {
    total: number;
    required: number;
    optional: number;
    foundRequired: number;
    foundOptional: number;
    missingRequired: number;
    results: Record<string, PatternResult>;
  };
  actual: {
    logFile: string;
    logContent?: string;
  };
  expected: {
    patterns: Record<string, PatternConfig>;
    requiredPatternCount: number;
    optionalPatternCount: number;
  };
  summary: string;
}

/**
 * Lifecycle log patterns (from trace impulse)
 */
const LIFECYCLE_PATTERNS: Record<string, PatternConfig> = {
  activity_start: {
    regex: 'Activity.*starting',
    description: 'Activity initialization log',
    minOccurrences: 1,
    example: 'Activity: Template Name starting',
  },
  memory_init: {
    regex: 'Memory agent initializing',
    description: 'Memory agent starts gathering context',
    minOccurrences: 1,
    example: 'Memory agent initializing',
  },
  memory_complete: {
    regex: 'Memory agent gathered.*impulses',
    description: 'Memory agent completes with impulse count',
    minOccurrences: 1,
    example: 'Memory agent gathered 3 impulses',
  },
  task_start: {
    regex: 'Task starting:',
    description: 'Task execution begins',
    minOccurrences: 1,
    example: 'Task starting: task-id',
  },
  task_complete: {
    regex: 'Task completed:',
    description: 'Task execution completes with metrics',
    minOccurrences: 1,
    example: 'Task completed: task-id',
  },
  storage_write: {
    regex: 'storage write confirmed',
    description: 'Storage persistence confirmation',
    minOccurrences: 1,
    example: 'storage write confirmed',
  },
  git_commit: {
    regex: 'Git commit created:',
    description: 'Git commit for activity (if git enabled)',
    minOccurrences: 0,
    optional: true,
    example: 'Git commit created: a1b2c3d',
  },
  activity_complete: {
    regex: 'Activity completed:',
    description: 'Activity completion with full metrics',
    minOccurrences: 1,
    example: 'Activity completed: Activity Title',
  },
};

/**
 * Execute activity in DevBob pod via kubectl
 */
function executeInKubectl(input: ValidationInput): { stdout: string; stderr: string; duration: number; exitCode: number } {
  const startTime = Date.now();
  
  const cmd = `kubectl exec -n ${input.namespace} ${input.pod} -- ` +
    `opencode activity ${input.templateId} ` +
    `--variables '${JSON.stringify(input.variables)}' ` +
    `--reason "${input.reason}"`;
  
  console.log(`Executing in kubectl: ${cmd}`);
  
  try {
    const stdout = execSync(cmd, {
      encoding: 'utf-8',
      timeout: (input.timeout || 180) * 1000,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    
    const duration = Date.now() - startTime;
    return { stdout, stderr: '', duration, exitCode: 0 };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      duration,
      exitCode: error.status || 1,
    };
  }
}

/**
 * Execute activity locally with opencode binary
 */
function executeLocally(input: ValidationInput): { stdout: string; stderr: string; duration: number; exitCode: number } {
  const startTime = Date.now();
  
  const binaryPath = input.binaryPath || 'opencode';
  const printLogsFlag = input.printLogs !== false ? '--print-logs' : '';
  
  const cmd = `${binaryPath} activity ${input.templateId} ` +
    `--variables '${JSON.stringify(input.variables)}' ` +
    `--reason "${input.reason}" ` +
    `${printLogsFlag}`;
  
  console.log(`Executing locally: ${cmd}`);
  
  try {
    const stdout = execSync(cmd, {
      encoding: 'utf-8',
      timeout: (input.timeout || 180) * 1000,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    
    const duration = Date.now() - startTime;
    return { stdout, stderr: '', duration, exitCode: 0 };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      duration,
      exitCode: error.status || 1,
    };
  }
}

/**
 * Capture logs from DevBob pod
 */
function capturePodLogs(pod: string, namespace: string): string {
  try {
    const logs = execSync(`kubectl logs -n ${namespace} ${pod} --tail=500`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return logs;
  } catch (error: any) {
    console.error('Error capturing pod logs:', error.message);
    return '';
  }
}

/**
 * Search for pattern in logs
 */
function findPattern(logs: string, pattern: PatternConfig): { found: boolean; occurrences: number; matches: string[] } {
  const regex = new RegExp(pattern.regex, 'gm');
  const matches = logs.match(regex) || [];
  
  return {
    found: matches.length >= pattern.minOccurrences,
    occurrences: matches.length,
    matches: matches.slice(0, 5), // Keep first 5 matches
  };
}

/**
 * Main validation function
 */
export function runValidation(input: ValidationInput): ValidationResult {
  const timestamp = Date.now();
  const logFile = `validation-logs-lifecycle-${timestamp}.log`;
  
  console.log('=== Activity Lifecycle Logging Validation ===');
  console.log(`Method: ${input.method}`);
  console.log(`Template: ${input.templateId}`);
  console.log(`Variables: ${JSON.stringify(input.variables)}`);
  console.log('');
  
  // Step 1: Execute activity
  console.log('Step 1/3: Executing activity in fresh process...');
  const execResult = input.method === 'kubectl' 
    ? executeInKubectl(input)
    : executeLocally(input);
  
  console.log(`Execution completed in ${execResult.duration}ms with exit code ${execResult.exitCode}`);
  console.log('');
  
  // Step 2: Capture logs
  console.log('Step 2/3: Capturing logs...');
  let logs = execResult.stdout;
  
  if (input.method === 'kubectl' && input.pod && input.namespace) {
    // For kubectl, also capture pod logs
    const podLogs = capturePodLogs(input.pod, input.namespace);
    logs = `${logs}\n\n=== POD LOGS ===\n${podLogs}`;
  }
  
  const logLines = logs.split('\n').length;
  console.log(`Captured ${logLines} lines of logs`);
  console.log('');
  
  // Save logs to file
  writeFileSync(logFile, logs, 'utf-8');
  console.log(`Logs saved to: ${logFile}`);
  console.log('');
  
  // Step 3: Validate patterns
  console.log('Step 3/3: Validating lifecycle patterns...');
  const patternResults: Record<string, PatternResult> = {};
  
  let requiredCount = 0;
  let optionalCount = 0;
  let foundRequired = 0;
  let foundOptional = 0;
  let missingRequired = 0;
  
  for (const [key, pattern] of Object.entries(LIFECYCLE_PATTERNS)) {
    const result = findPattern(logs, pattern);
    const isOptional = pattern.optional || false;
    const pass = result.occurrences >= pattern.minOccurrences;
    
    if (isOptional) {
      optionalCount++;
      if (pass) foundOptional++;
    } else {
      requiredCount++;
      if (pass) {
        foundRequired++;
      } else {
        missingRequired++;
      }
    }
    
    patternResults[key] = {
      pattern: key,
      regex: pattern.regex,
      description: pattern.description,
      found: result.found,
      occurrences: result.occurrences,
      minOccurrences: pattern.minOccurrences,
      optional: isOptional,
      pass,
      matches: result.matches,
    };
    
    const status = pass ? '✅' : (isOptional ? '⚠️' : '❌');
    console.log(`${status} ${key}: ${result.occurrences}/${pattern.minOccurrences} ${isOptional ? '(optional)' : ''}`);
    if (result.matches && result.matches.length > 0) {
      console.log(`   Example: ${result.matches[0]}`);
    }
  }
  
  console.log('');
  
  // Determine overall pass/fail
  const pass = missingRequired === 0;
  
  const summary = pass
    ? `✅ PASS: All ${requiredCount} required patterns found (${foundOptional}/${optionalCount} optional found)`
    : `❌ FAIL: ${missingRequired}/${requiredCount} required patterns missing`;
  
  console.log(summary);
  console.log('');
  
  return {
    pass,
    timestamp,
    method: input.method,
    execution: {
      command: input.method === 'kubectl' 
        ? `kubectl exec -n ${input.namespace} ${input.pod} -- opencode activity ${input.templateId}`
        : `opencode activity ${input.templateId}`,
      duration: execResult.duration,
      exitCode: execResult.exitCode,
      logLines,
    },
    patterns: {
      total: requiredCount + optionalCount,
      required: requiredCount,
      optional: optionalCount,
      foundRequired,
      foundOptional,
      missingRequired,
      results: patternResults,
    },
    actual: {
      logFile,
      logContent: logs.substring(0, 10000), // First 10KB for reference
    },
    expected: {
      patterns: LIFECYCLE_PATTERNS,
      requiredPatternCount: requiredCount,
      optionalPatternCount: optionalCount,
    },
    summary,
  };
}

/**
 * CLI entry point
 */
if (require.main === module) {
  // Default test case (from impulse validation-activity-lifecycle-logging-case-1)
  const input: ValidationInput = {
    method: 'kubectl',
    pod: process.env.DEVBOB_POD || 'devbob-794b69b4f4-rhnwg',
    namespace: process.env.DEVBOB_NAMESPACE || 'metabob',
    templateId: process.env.TEMPLATE_ID || 'simple-file-analysis',
    variables: {
      targetFile: 'README.md',
      operation: 'analyze',
    },
    reason: 'Lifecycle logging validation - verify all 8 log patterns appear',
    timeout: 180,
  };
  
  const result = runValidation(input);
  
  // Save result to file
  const resultFile = `validation-result-lifecycle-${result.timestamp}.json`;
  writeFileSync(resultFile, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Result saved to: ${resultFile}`);
  
  // Exit with appropriate code
  process.exit(result.pass ? 0 : 1);
}
