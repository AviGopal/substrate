/**
 * Activity System Runtime Validation Harness (TypeScript)
 * 
 * Purpose: Validate that all 8 lifecycle log patterns are visible in kubectl logs
 *          when executing an activity in the DevBob pod.
 *
 * Specification: Activity System Runtime Validation with Complete Log Confirmation
 *
 * Expected Patterns (8 total):
 *   1. Activity.*starting - Activity initialization with template metadata
 *   2. Memory agent initializing - Context gathering start
 *   3. Memory agent gathered.*impulses - Context gathering completion
 *   4. Task starting: - Task execution start
 *   5. Task completed: - Task execution completion with metrics
 *   6. storage write confirmed - Persistence layer writes
 *   7. Git commit created: - Git operations for activity
 *   8. Activity completed: - Final activity summary with full metrics
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

interface ValidationConfig {
  pod: string;
  namespace: string;
  timeout: number;
  testPrompt: string;
}

interface PatternResult {
  pattern: string;
  found: boolean;
  matches?: string[];
}

interface ValidationResult {
  pass: boolean;
  timestamp: number;
  execution: {
    duration: number;
    logLines: number;
  };
  patterns: {
    total: number;
    found: number;
    missing: number;
    results: Record<string, PatternResult>;
  };
  files: {
    logFile: string;
    reportFile: string;
  };
}

/**
 * Lifecycle log patterns to validate
 */
const LIFECYCLE_PATTERNS = {
  activity_start: /Activity.*starting/,
  memory_init: /Memory agent initializing/,
  memory_complete: /Memory agent gathered.*impulses/,
  task_start: /Task starting:/,
  task_complete: /Task completed:/,
  storage_write: /storage write confirmed/,
  git_commit: /Git commit created:/,
  activity_complete: /Activity completed:/,
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ValidationConfig = {
  pod: 'devbob-794b69b4f4-rhnwg',
  namespace: 'metabob',
  timeout: 180, // 3 minutes
  testPrompt: 'Analyze the test directory structure and create a summary file named analysis.txt',
};

/**
 * Run validation harness
 */
export async function runValidation(config: Partial<ValidationConfig> = {}): Promise<ValidationResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const timestamp = Date.now();
  const logFile = `validation-logs-${timestamp}.log`;
  const reportFile = `validation-report-${timestamp}.json`;

  console.log('=== Activity System Runtime Validation ===');
  console.log(`Pod: ${cfg.pod}`);
  console.log(`Namespace: ${cfg.namespace}`);
  console.log(`Log file: ${logFile}`);
  console.log('');

  // Step 1: Verify pod is running
  console.log('Step 1/6: Verifying pod status...');
  try {
    const podStatus = execSync(
      `kubectl get pod -n ${cfg.namespace} ${cfg.pod} -o jsonpath='{.status.phase}'`,
      { encoding: 'utf-8' }
    ).trim();
    
    if (podStatus !== 'Running') {
      throw new Error(`Pod is not running (status: ${podStatus})`);
    }
    console.log('Pod is running ✓\n');
  } catch (error) {
    console.error('Failed to verify pod:', error);
    throw error;
  }

  // Step 2: Execute test activity and capture logs
  console.log('Step 2/6: Executing test activity...');
  const startTime = Date.now();
  
  try {
    // Execute activity (this will block until completion or timeout)
    execSync(
      `kubectl exec -n ${cfg.namespace} ${cfg.pod} -- sh -c 'echo "${cfg.testPrompt}" | opencode run'`,
      { 
        encoding: 'utf-8',
        timeout: cfg.timeout * 1000,
        stdio: 'pipe'
      }
    );
  } catch (error) {
    console.warn('Activity execution completed with error (may be normal):', error);
  }
  
  const duration = Math.floor((Date.now() - startTime) / 1000);
  console.log(`Activity execution completed (${duration}s)\n`);

  // Step 3: Capture logs
  console.log('Step 3/6: Capturing pod logs...');
  const logs = execSync(
    `kubectl logs -n ${cfg.namespace} ${cfg.pod} --tail=1000`,
    { encoding: 'utf-8' }
  );
  
  writeFileSync(logFile, logs);
  const logLines = logs.split('\n').length;
  console.log(`Captured ${logLines} log lines\n`);

  // Step 4: Validate lifecycle patterns
  console.log('Step 4/6: Validating lifecycle log patterns...\n');
  
  const patternResults: Record<string, PatternResult> = {};
  let foundCount = 0;
  
  for (const [key, pattern] of Object.entries(LIFECYCLE_PATTERNS)) {
    const matches = logs.match(new RegExp(pattern, 'g'));
    const found = matches !== null && matches.length > 0;
    
    patternResults[key] = {
      pattern: pattern.source,
      found,
      matches: matches || undefined,
    };
    
    if (found) {
      foundCount++;
      console.log(`  ✓ Pattern '${key}': ${pattern.source}`);
    } else {
      console.log(`  ✗ Pattern '${key}': ${pattern.source}`);
    }
  }
  
  const totalPatterns = Object.keys(LIFECYCLE_PATTERNS).length;
  const missingCount = totalPatterns - foundCount;
  
  console.log('');
  console.log(`Patterns found: ${foundCount}/${totalPatterns}\n`);

  // Step 5: Generate validation result
  console.log('Step 5/6: Generating validation result...');
  
  const result: ValidationResult = {
    pass: foundCount === totalPatterns,
    timestamp,
    execution: {
      duration,
      logLines,
    },
    patterns: {
      total: totalPatterns,
      found: foundCount,
      missing: missingCount,
      results: patternResults,
    },
    files: {
      logFile,
      reportFile,
    },
  };

  // Step 6: Save report
  console.log('Step 6/6: Saving validation report...');
  writeFileSync(reportFile, JSON.stringify(result, null, 2));
  console.log(`Report saved to: ${reportFile}\n`);

  // Final result
  console.log('==========================================');
  if (result.pass) {
    console.log('✓ VALIDATION PASSED');
    console.log(`All ${totalPatterns} lifecycle log patterns are visible`);
    console.log('==========================================\n');
    console.log('Activity system runtime validation is COMPLETE with full observability.\n');
  } else {
    console.log('✗ VALIDATION FAILED');
    console.log(`Missing ${missingCount} lifecycle log patterns`);
    console.log('==========================================\n');
    console.log('Missing patterns:');
    for (const [key, result] of Object.entries(patternResults)) {
      if (!result.found) {
        console.log(`  - ${key}: ${result.pattern}`);
      }
    }
    console.log('');
  }

  return result;
}

/**
 * CLI entry point
 */
if (require.main === module) {
  const pod = process.argv[2];
  const namespace = process.argv[3];
  
  runValidation({ pod, namespace })
    .then((result) => {
      process.exit(result.pass ? 0 : 1);
    })
    .catch((error) => {
      console.error('Validation failed with error:', error);
      process.exit(1);
    });
}
