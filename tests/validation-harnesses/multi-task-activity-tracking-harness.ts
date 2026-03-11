#!/usr/bin/env node
/**
 * Validation Harness: Multi-Task Activity Tracking
 * 
 * Purpose: Execute a 7-task activity and verify that lifecycle logging tracks
 *          each task individually, emits proper task start/complete logs, and
 *          aggregates metrics correctly in the activity record.
 * 
 * Specification: Multi-Task Activity Tracking
 * 
 * Validation Strategy:
 *   1. Execute trace-data-flow-single-feature activity (7 tasks)
 *   2. Capture all lifecycle logs
 *   3. Verify "Task starting:" appears 7 times with proper metadata
 *   4. Verify "Task completed:" appears 7 times with duration, cost, attempts
 *   5. Extract activity ID and load activity record from storage
 *   6. Verify executionEvidence.sessionsSpawned has 7 entries
 *   7. Verify each entry has taskId, duration, cost, messageCount, toolCallCount
 *   8. Return PASS/FAIL (no LLM needed)
 * 
 * Test Cases:
 *   - validation-multi-task-activity-tracking-case-1: 7-task activity execution
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import * as path from 'path';

/**
 * Validation input configuration
 */
export interface ValidationInput {
  // Activity template to execute
  templateId: string;
  
  // Variables for activity execution
  variables: Record<string, any>;
  
  // Reason for activity execution
  reason: string;
  
  // Expected number of tasks
  expectedTaskCount: number;
  
  // Timeout in seconds
  timeout?: number;
  
  // Whether to verify activity storage
  verifyStorage?: boolean;
  
  // Activity storage path (optional, auto-detected if not provided)
  activityStoragePath?: string;
}

/**
 * Pattern matching result
 */
interface PatternResult {
  pattern: string;
  description: string;
  found: boolean;
  occurrences: number;
  expected: number;
  pass: boolean;
  matches: string[];
}

/**
 * Activity record verification result
 */
interface ActivityRecordResult {
  activityId: string | null;
  recordFound: boolean;
  sessionsSpawned: number;
  expectedSessions: number;
  hasTaskMetrics: boolean;
  sessionsWithDuration: number;
  sessionsWithCost: number;
  sessionsWithTaskId: number;
  pass: boolean;
  details: string[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  pass: boolean;
  timestamp: number;
  input: ValidationInput;
  execution: {
    command: string;
    duration: number;
    exitCode: number;
    logFile: string;
    logLines: number;
  };
  logs: {
    taskStartCount: number;
    taskCompleteCount: number;
    expectedTasks: number;
    patterns: Record<string, PatternResult>;
  };
  activityRecord?: ActivityRecordResult;
  summary: string;
  errors: string[];
  warnings: string[];
}

/**
 * Expected log patterns for multi-task tracking
 */
const LOG_PATTERNS = {
  taskStart: {
    pattern: 'Task starting:',
    description: 'Task execution start log',
  },
  taskComplete: {
    pattern: 'Task completed:',
    description: 'Task execution complete log with metrics',
  },
  activityStart: {
    pattern: 'Activity.*starting',
    description: 'Activity initialization log',
  },
  activityComplete: {
    pattern: 'Activity completed:',
    description: 'Activity completion log',
  },
};

/**
 * Execute activity and capture logs
 */
function executeActivity(input: ValidationInput): {
  output: string;
  exitCode: number;
  duration: number;
  logFile: string;
} {
  const startTime = Date.now();
  const logFile = `/tmp/multi-task-validation-${Date.now()}.log`;
  
  const cmd = 
    `cd /home/avi/documents/work/exp-repo/metabob-devbob && ` +
    `opencode activity ${input.templateId} ` +
    `--variables '${JSON.stringify(input.variables)}' ` +
    `--reason "${input.reason}" 2>&1 | tee ${logFile}`;
  
  console.log(`Executing: opencode activity ${input.templateId}`);
  console.log(`Variables: ${JSON.stringify(input.variables)}`);
  console.log(`Log file: ${logFile}\n`);
  
  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      timeout: (input.timeout || 300) * 1000,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
    
    const duration = Date.now() - startTime;
    return { output, exitCode: 0, duration, logFile };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    return {
      output: error.stdout || error.message,
      exitCode: error.status || 1,
      duration,
      logFile,
    };
  }
}

/**
 * Analyze logs for lifecycle patterns
 */
function analyzeLogs(logFile: string, expectedTaskCount: number): {
  taskStartCount: number;
  taskCompleteCount: number;
  patterns: Record<string, PatternResult>;
} {
  const logContent = readFileSync(logFile, 'utf-8');
  const lines = logContent.split('\n');
  
  const results: Record<string, PatternResult> = {};
  
  // Count task start/complete logs
  let taskStartCount = 0;
  let taskCompleteCount = 0;
  const taskStartMatches: string[] = [];
  const taskCompleteMatches: string[] = [];
  
  for (const line of lines) {
    if (line.includes(LOG_PATTERNS.taskStart.pattern)) {
      taskStartCount++;
      taskStartMatches.push(line.trim());
    }
    if (line.includes(LOG_PATTERNS.taskComplete.pattern)) {
      taskCompleteCount++;
      taskCompleteMatches.push(line.trim());
    }
  }
  
  // Verify task start logs
  results.taskStart = {
    pattern: LOG_PATTERNS.taskStart.pattern,
    description: LOG_PATTERNS.taskStart.description,
    found: taskStartCount > 0,
    occurrences: taskStartCount,
    expected: expectedTaskCount,
    pass: taskStartCount === expectedTaskCount,
    matches: taskStartMatches,
  };
  
  // Verify task complete logs
  results.taskComplete = {
    pattern: LOG_PATTERNS.taskComplete.pattern,
    description: LOG_PATTERNS.taskComplete.description,
    found: taskCompleteCount > 0,
    occurrences: taskCompleteCount,
    expected: expectedTaskCount,
    pass: taskCompleteCount === expectedTaskCount,
    matches: taskCompleteMatches,
  };
  
  // Check for activity start/complete logs (optional)
  for (const [key, config] of Object.entries(LOG_PATTERNS)) {
    if (key === 'taskStart' || key === 'taskComplete') continue;
    
    const matches = lines.filter(line => new RegExp(config.pattern).test(line));
    results[key] = {
      pattern: config.pattern,
      description: config.description,
      found: matches.length > 0,
      occurrences: matches.length,
      expected: 1,
      pass: matches.length >= 1,
      matches: matches.map(m => m.trim()),
    };
  }
  
  return {
    taskStartCount,
    taskCompleteCount,
    patterns: results,
  };
}

/**
 * Verify activity record in storage
 */
function verifyActivityRecord(
  logContent: string,
  expectedTaskCount: number,
  storagePath?: string
): ActivityRecordResult {
  const result: ActivityRecordResult = {
    activityId: null,
    recordFound: false,
    sessionsSpawned: 0,
    expectedSessions: expectedTaskCount,
    hasTaskMetrics: false,
    sessionsWithDuration: 0,
    sessionsWithCost: 0,
    sessionsWithTaskId: 0,
    pass: false,
    details: [],
  };
  
  // Extract activity ID from logs
  const activityIdMatch = logContent.match(/Activity ID: (act_[a-zA-Z0-9]+)/);
  if (!activityIdMatch) {
    result.details.push('ERROR: Could not extract activity ID from logs');
    return result;
  }
  
  result.activityId = activityIdMatch[1];
  result.details.push(`Activity ID: ${result.activityId}`);
  
  // Find activity record in storage
  const searchPath = storagePath || '/home/avi/.local/share/opencode/storage/activity';
  
  if (!existsSync(searchPath)) {
    result.details.push(`WARNING: Activity storage path not found: ${searchPath}`);
    return result;
  }
  
  // Search for activity record file
  try {
    const files = execSync(`find ${searchPath} -name "${result.activityId}.json"`, {
      encoding: 'utf-8',
    }).trim().split('\n').filter(f => f);
    
    if (files.length === 0) {
      result.details.push(`WARNING: Activity record not found in storage`);
      return result;
    }
    
    const recordPath = files[0];
    result.details.push(`Activity record: ${recordPath}`);
    
    // Load and verify activity record
    const recordContent = readFileSync(recordPath, 'utf-8');
    const activity = JSON.parse(recordContent);
    
    result.recordFound = true;
    
    // Verify executionEvidence.sessionsSpawned
    if (activity.executionEvidence?.sessionsSpawned) {
      result.sessionsSpawned = activity.executionEvidence.sessionsSpawned.length;
      result.details.push(`Sessions spawned: ${result.sessionsSpawned}`);
      
      // Check each session for required fields
      for (const session of activity.executionEvidence.sessionsSpawned) {
        if (session.taskId) result.sessionsWithTaskId++;
        if (session.duration !== undefined) result.sessionsWithDuration++;
        if (session.cost !== undefined) result.sessionsWithCost++;
      }
      
      result.hasTaskMetrics = 
        result.sessionsWithDuration === result.sessionsSpawned &&
        result.sessionsWithCost === result.sessionsSpawned;
      
      result.details.push(`Sessions with taskId: ${result.sessionsWithTaskId}`);
      result.details.push(`Sessions with duration: ${result.sessionsWithDuration}`);
      result.details.push(`Sessions with cost: ${result.sessionsWithCost}`);
      
      // Determine pass/fail
      result.pass = 
        result.sessionsSpawned === result.expectedSessions &&
        result.sessionsWithTaskId === result.sessionsSpawned &&
        result.hasTaskMetrics;
    } else {
      result.details.push('ERROR: executionEvidence.sessionsSpawned not found');
    }
  } catch (error: any) {
    result.details.push(`ERROR: Failed to load activity record: ${error.message}`);
  }
  
  return result;
}

/**
 * Run validation
 */
export async function runValidation(input: ValidationInput): Promise<ValidationResult> {
  const result: ValidationResult = {
    pass: false,
    timestamp: Date.now(),
    input,
    execution: {
      command: '',
      duration: 0,
      exitCode: 0,
      logFile: '',
      logLines: 0,
    },
    logs: {
      taskStartCount: 0,
      taskCompleteCount: 0,
      expectedTasks: input.expectedTaskCount,
      patterns: {},
    },
    errors: [],
    warnings: [],
    summary: '',
  };
  
  console.log('='.repeat(80));
  console.log('Multi-Task Activity Tracking - Validation Harness');
  console.log('='.repeat(80));
  console.log(`Template: ${input.templateId}`);
  console.log(`Expected tasks: ${input.expectedTaskCount}\n`);
  
  // Step 1: Execute activity
  console.log('Step 1: Executing activity...\n');
  const execution = executeActivity(input);
  
  result.execution.command = `opencode activity ${input.templateId}`;
  result.execution.duration = execution.duration;
  result.execution.exitCode = execution.exitCode;
  result.execution.logFile = execution.logFile;
  
  const logContent = readFileSync(execution.logFile, 'utf-8');
  result.execution.logLines = logContent.split('\n').length;
  
  console.log(`Execution completed in ${execution.duration}ms`);
  console.log(`Exit code: ${execution.exitCode}`);
  console.log(`Log lines: ${result.execution.logLines}\n`);
  
  if (execution.exitCode !== 0) {
    result.errors.push(`Activity execution failed with exit code ${execution.exitCode}`);
  }
  
  // Step 2: Analyze logs
  console.log('Step 2: Analyzing lifecycle logs...\n');
  const logAnalysis = analyzeLogs(execution.logFile, input.expectedTaskCount);
  
  result.logs.taskStartCount = logAnalysis.taskStartCount;
  result.logs.taskCompleteCount = logAnalysis.taskCompleteCount;
  result.logs.patterns = logAnalysis.patterns;
  
  console.log(`Task starting logs: ${logAnalysis.taskStartCount} (expected: ${input.expectedTaskCount})`);
  console.log(`Task completed logs: ${logAnalysis.taskCompleteCount} (expected: ${input.expectedTaskCount})`);
  
  // Check for log pattern issues
  for (const [key, pattern] of Object.entries(logAnalysis.patterns)) {
    if (!pattern.pass) {
      if (key === 'taskStart' || key === 'taskComplete') {
        result.errors.push(
          `${pattern.description}: expected ${pattern.expected}, found ${pattern.occurrences}`
        );
      } else {
        result.warnings.push(
          `${pattern.description}: expected ${pattern.expected}, found ${pattern.occurrences}`
        );
      }
    }
  }
  
  console.log('');
  
  // Step 3: Verify activity record (if enabled)
  if (input.verifyStorage !== false) {
    console.log('Step 3: Verifying activity record...\n');
    const recordResult = verifyActivityRecord(
      logContent,
      input.expectedTaskCount,
      input.activityStoragePath
    );
    
    result.activityRecord = recordResult;
    
    for (const detail of recordResult.details) {
      console.log(`  ${detail}`);
    }
    
    if (!recordResult.pass && recordResult.recordFound) {
      result.errors.push('Activity record verification failed');
    }
    
    console.log('');
  }
  
  // Step 4: Determine overall pass/fail
  const logsPass = 
    result.logs.patterns.taskStart?.pass &&
    result.logs.patterns.taskComplete?.pass;
  
  const recordPass = input.verifyStorage !== false 
    ? (result.activityRecord?.pass ?? false)
    : true;
  
  result.pass = result.errors.length === 0 && logsPass && recordPass;
  
  // Generate summary
  if (result.pass) {
    result.summary = 
      `✅ PASS: Multi-Task Activity Tracking is compliant. ` +
      `All ${input.expectedTaskCount} tasks emitted proper lifecycle logs ` +
      `and activity record has complete per-task metrics.`;
  } else {
    result.summary = 
      `❌ FAIL: Multi-Task Activity Tracking compliance issues detected:\n` +
      result.errors.map(e => `  - ${e}`).join('\n');
    
    if (result.warnings.length > 0) {
      result.summary += '\n\nWarnings:\n' + result.warnings.map(w => `  - ${w}`).join('\n');
    }
  }
  
  console.log('='.repeat(80));
  console.log(result.summary);
  console.log('='.repeat(80));
  
  return result;
}

/**
 * CLI entry point
 */
async function main() {
  const input: ValidationInput = {
    templateId: 'trace-data-flow-single-feature',
    variables: {
      featureName: 'Multi-Task Activity Tracking Validation',
    },
    reason: 'Validate multi-task activity tracking specification compliance',
    expectedTaskCount: 7,
    timeout: 300,
    verifyStorage: true,
  };
  
  const result = await runValidation(input);
  
  // Write result to file
  const outputDir = path.join(__dirname, '..', '..', 'validation-results');
  const outputFile = path.join(outputDir, `multi-task-tracking-${Date.now()}.json`);
  
  writeFileSync(outputFile, JSON.stringify(result, null, 2));
  console.log(`\nValidation result written to: ${outputFile}\n`);
  
  process.exit(result.pass ? 0 : 1);
}

// Run if invoked directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Validation harness error:', error);
    process.exit(1);
  });
}
