/**
 * Activity Execution Debugger
 * 
 * Provides transparent, step-by-step execution tracking for activity templates.
 * Makes failure causes immediately visible through structured logging and diagnostics.
 */

import { EventEmitter } from 'events';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export enum ExecutionPhase {
  INITIALIZATION = 'initialization',
  DISCOVERY = 'discovery',
  PLANNING = 'planning',
  EXECUTION = 'execution',
  VALIDATION = 'validation',
  COMPLETION = 'completion',
  ERROR_RECOVERY = 'error_recovery'
}

export enum ExecutionState {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  SUCCESS = 'success',
  WARNING = 'warning',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export interface ExecutionTrace {
  timestamp: number;
  phase: ExecutionPhase;
  component: string;
  action: string;
  state: ExecutionState;
  duration?: number;
  metadata?: Record<string, any>;
  error?: Error;
  childTraces?: ExecutionTrace[];
}

export interface ActivityCheckpoint {
  id: string;
  timestamp: number;
  phase: ExecutionPhase;
  description: string;
  state: ExecutionState;
  assertions: CheckpointAssertion[];
  metrics?: Record<string, number | string | boolean>;
}

export interface CheckpointAssertion {
  name: string;
  expected: any;
  actual?: any;
  passed: boolean;
  reason?: string;
}

export interface ExecutionDiagnostic {
  activityId: string;
  type: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  phases: Map<ExecutionPhase, ExecutionTrace[]>;
  checkpoints: ActivityCheckpoint[];
  failures: ExecutionFailure[];
  warnings: ExecutionWarning[];
  rootCause?: RootCauseAnalysis;
}

export interface ExecutionFailure {
  checkpoint: string;
  assertion: CheckpointAssertion;
  phase: ExecutionPhase;
  timestamp: number;
  stack?: string;
  context?: Record<string, any>;
  suggestedFix?: string;
}

export interface ExecutionWarning {
  checkpoint: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
  phase: ExecutionPhase;
  timestamp: number;
  actionItem?: string;
}

export interface RootCauseAnalysis {
  failurePoint: string;
  immediateReason: string;
  contributingFactors: string[];
  preventionStrategies: string[];
  diagnosticCommands: string[];
  timeline: TimelineEvent[];
}

export interface TimelineEvent {
  time: number;
  description: string;
  state: ExecutionState;
  significance: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

// ============================================================================
// MAIN DEBUGGER CLASS
// ============================================================================

export class ActivityExecutionDebugger extends EventEmitter {
  private diagnostic: ExecutionDiagnostic;
  private currentPhase: ExecutionPhase;
  private phaseStartTime: number = 0;
  private checkpointStack: string[] = [];
  private debugDir: string;
  private enableConsoleOutput: boolean = true;
  private enableFileOutput: boolean = true;
  private checkpointValidators: Map<string, (checkpoint: ActivityCheckpoint) => void> = new Map();

  constructor(
    private activityId: string,
    private activityType: string,
    outputDir: string = './.debug'
  ) {
    super();
    this.debugDir = outputDir;
    this.currentPhase = ExecutionPhase.INITIALIZATION;
    this.diagnostic = {
      activityId,
      type: activityType,
      startTime: Date.now(),
      phases: new Map(),
      checkpoints: [],
      failures: [],
      warnings: [],
    };

    if (this.enableFileOutput) {
      this.ensureDebugDirectory();
    }

    this.log('🚀 Activity Execution Debugger Initialized', {
      activityId,
      activityType,
      timestamp: new Date().toISOString(),
    });
  }

  // =========================================================================
  // PHASE MANAGEMENT
  // =========================================================================

  /**
   * Enter a new execution phase
   */
  enterPhase(phase: ExecutionPhase, description?: string): void {
    const previousPhase = this.currentPhase;
    this.currentPhase = phase;
    this.phaseStartTime = Date.now();

    this.log(`📍 Entering ${phase}${description ? ': ' + description : ''}`, {
      previousPhase,
      newPhase: phase,
    });

    this.emitEvent('phase_enter', { phase, previousPhase, description });
  }

  /**
   * Exit the current phase
   */
  exitPhase(state: ExecutionState = ExecutionState.SUCCESS): void {
    const duration = Date.now() - this.phaseStartTime;
    const phase = this.currentPhase;

    this.log(`✅ Exiting ${phase} (${duration}ms)`, {
      state,
      duration,
    });

    this.emitEvent('phase_exit', { phase, state, duration });
  }

  // =========================================================================
  // CHECKPOINT SYSTEM
  // =========================================================================

  /**
   * Create a named checkpoint with assertions
   */
  checkpoint(
    id: string,
    description: string,
    phase?: ExecutionPhase
  ): CheckpointHandle {
    const checkpoint: ActivityCheckpoint = {
      id,
      timestamp: Date.now(),
      phase: phase || this.currentPhase,
      description,
      state: ExecutionState.PENDING,
      assertions: [],
    };

    this.diagnostic.checkpoints.push(checkpoint);
    this.checkpointStack.push(id);

    this.log(`📌 Checkpoint: ${description}`, {
      checkpointId: id,
      phase: checkpoint.phase,
    });

    return new CheckpointHandle(this, checkpoint);
  }

  /**
   * Validate a checkpoint based on registered validators
   */
  private validateCheckpoint(checkpoint: ActivityCheckpoint): boolean {
    const validator = this.checkpointValidators.get(checkpoint.id);
    if (validator) {
      try {
        validator(checkpoint);
        return true;
      } catch (error) {
        this.recordFailure(checkpoint, error);
        return false;
      }
    }
    return true;
  }

  /**
   * Register a checkpoint validator
   */
  registerValidator(
    checkpointId: string,
    validator: (checkpoint: ActivityCheckpoint) => void
  ): void {
    this.checkpointValidators.set(checkpointId, validator);
  }

  // =========================================================================
  // ASSERTION SYSTEM
  // =========================================================================

  /**
   * Create an assertion at current checkpoint
   */
  assert(
    name: string,
    expected: any,
    actual?: any,
    reason?: string
  ): boolean {
    const currentCheckpoint = this.getLastCheckpoint();
    if (!currentCheckpoint) {
      this.warn('Assert called without active checkpoint', { name, expected, actual });
      return false;
    }

    const assertion: CheckpointAssertion = {
      name,
      expected,
      actual,
      passed: this.deepEquals(expected, actual),
      reason,
    };

    currentCheckpoint.assertions.push(assertion);

    if (!assertion.passed) {
      this.log(`❌ Assertion Failed: ${name}`, {
        expected,
        actual,
        reason,
      }, 'error');

      this.recordAssertion(currentCheckpoint, assertion);
      this.emitEvent('assertion_failed', { assertion, checkpoint: currentCheckpoint });
      return false;
    } else {
      this.log(`✅ Assertion Passed: ${name}`, {
        expected,
        actual,
      }, 'debug');
    }

    return true;
  }

  /**
   * Assert a condition with custom message
   */
  assertTrue(name: string, condition: boolean, reason?: string): boolean {
    return this.assert(name, true, condition, reason || 'Condition must be true');
  }

  /**
   * Assert equality
   */
  assertEqual(name: string, expected: any, actual: any, reason?: string): boolean {
    return this.assert(name, expected, actual, reason || `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }

  /**
   * Assert inequality
   */
  assertNotEqual(name: string, unexpected: any, actual: any, reason?: string): boolean {
    const passed = !this.deepEquals(unexpected, actual);
    const assertion: CheckpointAssertion = {
      name,
      expected: `not ${JSON.stringify(unexpected)}`,
      actual,
      passed,
      reason: reason || `Should not equal ${JSON.stringify(unexpected)}`,
    };

    const checkpoint = this.getLastCheckpoint();
    if (checkpoint) {
      checkpoint.assertions.push(assertion);
      if (!passed) {
        this.recordAssertion(checkpoint, assertion);
      }
    }

    return passed;
  }

  // =========================================================================
  // METRIC TRACKING
  // =========================================================================

  /**
   * Record metrics at current checkpoint
   */
  recordMetrics(metrics: Record<string, number | string | boolean>): void {
    const checkpoint = this.getLastCheckpoint();
    if (checkpoint) {
      checkpoint.metrics = { ...checkpoint.metrics, ...metrics };
      this.log('📊 Metrics Recorded', metrics);
    }
  }

  /**
   * Track execution timing
   */
  async timeOperation<T>(
    name: string,
    operation: () => Promise<T>,
    threshold?: number
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      this.recordMetrics({
        [`${name}_duration_ms`]: duration,
        [`${name}_success`]: true,
      });

      if (threshold && duration > threshold) {
        this.warn(`⚠️  Operation exceeded threshold: ${name}`, {
          duration,
          threshold,
          exceeded: duration - threshold,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordMetrics({
        [`${name}_duration_ms`]: duration,
        [`${name}_success`]: false,
      });
      throw error;
    }
  }

  // =========================================================================
  // FAILURE RECORDING
  // =========================================================================

  /**
   * Record a failure for root cause analysis
   */
  private recordFailure(checkpoint: ActivityCheckpoint, error: Error | unknown): void {
    checkpoint.state = ExecutionState.FAILED;

    const failure: ExecutionFailure = {
      checkpoint: checkpoint.id,
      assertion: checkpoint.assertions[checkpoint.assertions.length - 1],
      phase: checkpoint.phase,
      timestamp: Date.now(),
      stack: error instanceof Error ? error.stack : undefined,
      context: this.captureContext(),
    };

    this.diagnostic.failures.push(failure);
    this.emitEvent('failure_recorded', failure);
  }

  /**
   * Record a warning
   */
  private warn(message: string, context?: Record<string, any>): void {
    const warning: ExecutionWarning = {
      checkpoint: this.getLastCheckpoint()?.id || 'unknown',
      severity: 'MEDIUM',
      message,
      phase: this.currentPhase,
      timestamp: Date.now(),
    };

    this.diagnostic.warnings.push(warning);

    if (this.enableConsoleOutput) {
      console.log(chalk.yellow(`⚠️  ${message}`), context || '');
    }

    this.emitEvent('warning_recorded', warning);
  }

  /**
   * Record assertion result
   */
  private recordAssertion(checkpoint: ActivityCheckpoint, assertion: CheckpointAssertion): void {
    // Find if this is part of a failure chain
    const lastFailure = this.diagnostic.failures[this.diagnostic.failures.length - 1];
    if (lastFailure && !assertion.passed) {
      lastFailure.context = {
        ...lastFailure.context,
        failedAssertion: assertion,
      };
    }
  }

  // =========================================================================
  // ROOT CAUSE ANALYSIS
  // =========================================================================

  /**
   * Analyze failures to identify root cause
   */
  analyzeRootCause(): RootCauseAnalysis | undefined {
    if (this.diagnostic.failures.length === 0) {
      return undefined;
    }

    const firstFailure = this.diagnostic.failures[0];
    const failureChain = this.diagnostic.failures.map((f, i) => ({
      order: i,
      checkpoint: f.checkpoint,
      phase: f.phase,
      timestamp: f.timestamp,
    }));

    const contributingFactors: string[] = [];
    const preventionStrategies: string[] = [];
    const diagnosticCommands: string[] = [];

    // Analyze failure pattern
    if (failureChain.length > 1) {
      contributingFactors.push('Multiple checkpoint failures detected - cascading failure');
      preventionStrategies.push('Add earlier checkpoint validation');
      preventionStrategies.push('Implement circuit breaker pattern');
    }

    // Check phase transitions
    const phases = new Set(failureChain.map(f => f.phase));
    if (phases.size > 1) {
      contributingFactors.push('Failures across multiple phases');
      preventionStrategies.push('Add phase-level validation before transitions');
    }

    // Time-based analysis
    const timingGaps = this.analyzeTimingGaps();
    if (timingGaps.length > 0) {
      contributingFactors.push(`Timing issues detected: ${timingGaps.join(', ')}`);
      preventionStrategies.push('Add explicit wait/synchronization points');
      diagnosticCommands.push('npm run debug:activity:timing');
    }

    // State analysis
    const stateIssues = this.analyzeStateTransitions();
    if (stateIssues.length > 0) {
      contributingFactors.push(`State management issues: ${stateIssues.join(', ')}`);
      preventionStrategies.push('Implement state machine validation');
      diagnosticCommands.push('npm run debug:activity:state');
    }

    const analysis: RootCauseAnalysis = {
      failurePoint: firstFailure.checkpoint,
      immediateReason: firstFailure.assertion.reason || 'Assertion failed',
      contributingFactors,
      preventionStrategies,
      diagnosticCommands,
      timeline: this.buildTimeline(),
    };

    this.diagnostic.rootCause = analysis;
    return analysis;
  }

  /**
   * Analyze timing gaps between checkpoints
   */
  private analyzeTimingGaps(): string[] {
    const gaps: string[] = [];
    const checkpoints = this.diagnostic.checkpoints;

    for (let i = 1; i < checkpoints.length; i++) {
      const gap = checkpoints[i].timestamp - checkpoints[i - 1].timestamp;
      if (gap > 5000) {
        gaps.push(`${checkpoints[i - 1].id} -> ${checkpoints[i].id}: ${gap}ms`);
      }
    }

    return gaps;
  }

  /**
   * Analyze state transitions for issues
   */
  private analyzeStateTransitions(): string[] {
    const issues: string[] = [];
    const checkpoints = this.diagnostic.checkpoints;

    for (let i = 1; i < checkpoints.length; i++) {
      const prev = checkpoints[i - 1];
      const curr = checkpoints[i];

      // Check for invalid state transitions
      if (prev.state === ExecutionState.FAILED && curr.state === ExecutionState.SUCCESS) {
        issues.push(`State regression at ${curr.id}: recovered from failed state`);
      }
    }

    return issues;
  }

  /**
   * Build timeline of significant events
   */
  private buildTimeline(): TimelineEvent[] {
    const timeline: TimelineEvent[] = [];

    // Add checkpoint events
    for (const checkpoint of this.diagnostic.checkpoints) {
      timeline.push({
        time: checkpoint.timestamp,
        description: checkpoint.description,
        state: checkpoint.state,
        significance: this.calculateSignificance(checkpoint),
      });
    }

    // Add failure events
    for (const failure of this.diagnostic.failures) {
      timeline.push({
        time: failure.timestamp,
        description: `Failure: ${failure.checkpoint}`,
        state: ExecutionState.FAILED,
        significance: 'CRITICAL',
      });
    }

    // Sort by time
    return timeline.sort((a, b) => a.time - b.time);
  }

  /**
   * Calculate significance of a checkpoint
   */
  private calculateSignificance(checkpoint: ActivityCheckpoint): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    if (checkpoint.state === ExecutionState.FAILED) return 'CRITICAL';
    if (checkpoint.assertions.some(a => !a.passed)) return 'HIGH';
    if ((checkpoint.metrics?.['duration_ms'] as number) > 5000) return 'MEDIUM';
    return 'LOW';
  }

  // =========================================================================
  // CONTEXT CAPTURE
  // =========================================================================

  /**
   * Capture execution context for debugging
   */
  private captureContext(): Record<string, any> {
    return {
      currentPhase: this.currentPhase,
      checkpointStack: [...this.checkpointStack],
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      checkpointCount: this.diagnostic.checkpoints.length,
      failureCount: this.diagnostic.failures.length,
      warningCount: this.diagnostic.warnings.length,
    };
  }

  // =========================================================================
  // REPORTING
  // =========================================================================

  /**
   * Generate comprehensive execution report
   */
  generateReport(): string {
    const lines: string[] = [];

    lines.push('═'.repeat(80));
    lines.push('ACTIVITY EXECUTION DIAGNOSTIC REPORT');
    lines.push('═'.repeat(80));
    lines.push('');

    // Summary
    lines.push('SUMMARY');
    lines.push('─'.repeat(40));
    lines.push(`Activity ID: ${this.diagnostic.activityId}`);
    lines.push(`Type: ${this.diagnostic.type}`);
    lines.push(`Start Time: ${new Date(this.diagnostic.startTime).toISOString()}`);
    lines.push(`Duration: ${this.diagnostic.duration}ms`);
    lines.push(`Checkpoints: ${this.diagnostic.checkpoints.length}`);
    lines.push(`Failures: ${this.diagnostic.failures.length}`);
    lines.push(`Warnings: ${this.diagnostic.warnings.length}`);
    lines.push('');

    // Execution Timeline
    if (this.diagnostic.rootCause?.timeline) {
      lines.push('EXECUTION TIMELINE');
      lines.push('─'.repeat(40));
      for (const event of this.diagnostic.rootCause.timeline) {
        const symbol = this.getStateSymbol(event.state);
        lines.push(
          `  ${symbol} [${new Date(event.time).toISOString()}] ${event.description} (${event.significance})`
        );
      }
      lines.push('');
    }

    // Checkpoints
    if (this.diagnostic.checkpoints.length > 0) {
      lines.push('CHECKPOINTS');
      lines.push('─'.repeat(40));
      for (const cp of this.diagnostic.checkpoints) {
        const symbol = this.getStateSymbol(cp.state);
        lines.push(`  ${symbol} ${cp.id}: ${cp.description}`);
        
        if (cp.assertions.length > 0) {
          for (const assertion of cp.assertions) {
            const assertionSymbol = assertion.passed ? '✅' : '❌';
            lines.push(`     ${assertionSymbol} ${assertion.name}`);
            if (!assertion.passed) {
              lines.push(`        Expected: ${JSON.stringify(assertion.expected)}`);
              lines.push(`        Actual: ${JSON.stringify(assertion.actual)}`);
              if (assertion.reason) {
                lines.push(`        Reason: ${assertion.reason}`);
              }
            }
          }
        }

        if (cp.metrics) {
          lines.push(`     📊 Metrics: ${JSON.stringify(cp.metrics)}`);
        }
        lines.push('');
      }
    }

    // Failures
    if (this.diagnostic.failures.length > 0) {
      lines.push('FAILURES');
      lines.push('─'.repeat(40));
      for (const failure of this.diagnostic.failures) {
        lines.push(`  ❌ ${failure.checkpoint} (Phase: ${failure.phase})`);
        if (failure.assertion) {
          lines.push(`     Assertion: ${failure.assertion.name}`);
          lines.push(`     Reason: ${failure.assertion.reason}`);
        }
        if (failure.context) {
          lines.push(`     Context: ${JSON.stringify(failure.context, null, 2)}`);
        }
        if (failure.stack) {
          lines.push(`     Stack: ${failure.stack}`);
        }
        lines.push('');
      }
    }

    // Root Cause Analysis
    if (this.diagnostic.rootCause) {
      lines.push('ROOT CAUSE ANALYSIS');
      lines.push('─'.repeat(40));
      lines.push(`Failure Point: ${this.diagnostic.rootCause.failurePoint}`);
      lines.push(`Immediate Reason: ${this.diagnostic.rootCause.immediateReason}`);
      lines.push('');

      if (this.diagnostic.rootCause.contributingFactors.length > 0) {
        lines.push('Contributing Factors:');
        for (const factor of this.diagnostic.rootCause.contributingFactors) {
          lines.push(`  • ${factor}`);
        }
        lines.push('');
      }

      if (this.diagnostic.rootCause.preventionStrategies.length > 0) {
        lines.push('Prevention Strategies:');
        for (const strategy of this.diagnostic.rootCause.preventionStrategies) {
          lines.push(`  • ${strategy}`);
        }
        lines.push('');
      }

      if (this.diagnostic.rootCause.diagnosticCommands.length > 0) {
        lines.push('Diagnostic Commands:');
        for (const cmd of this.diagnostic.rootCause.diagnosticCommands) {
          lines.push(`  $ ${cmd}`);
        }
        lines.push('');
      }
    }

    lines.push('═'.repeat(80));

    return lines.join('\n');
  }

  /**
   * Get state symbol for display
   */
  private getStateSymbol(state: ExecutionState): string {
    switch (state) {
      case ExecutionState.SUCCESS: return '✅';
      case ExecutionState.FAILED: return '❌';
      case ExecutionState.WARNING: return '⚠️';
      case ExecutionState.IN_PROGRESS: return '⏳';
      case ExecutionState.PENDING: return '⏹️';
      case ExecutionState.SKIPPED: return '⊘';
      default: return '❓';
    }
  }

  /**
   * Export diagnostic as JSON
   */
  exportJSON(): string {
    // Convert Map to Object for serialization
    const phasesObj: Record<string, ExecutionTrace[]> = {};
    for (const [phase, traces] of this.diagnostic.phases) {
      phasesObj[phase] = traces;
    }

    return JSON.stringify(
      {
        ...this.diagnostic,
        phases: phasesObj,
        endTime: Date.now(),
        duration: Date.now() - this.diagnostic.startTime,
      },
      null,
      2
    );
  }

  /**
   * Save report to file
   */
  saveReport(format: 'text' | 'json' = 'text'): string {
    this.ensureDebugDirectory();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = format === 'json'
      ? `activity-${this.activityId}-${timestamp}.json`
      : `activity-${this.activityId}-${timestamp}.txt`;

    const filepath = join(this.debugDir, filename);
    const content = format === 'json' ? this.exportJSON() : this.generateReport();

    writeFileSync(filepath, content, 'utf-8');
    this.log(`📄 Report saved to ${filepath}`);

    return filepath;
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Deep equality check
   */
  private deepEquals(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every(key => this.deepEquals(a[key], b[key]));
    }

    return false;
  }

  /**
   * Get last checkpoint
   */
  private getLastCheckpoint(): ActivityCheckpoint | undefined {
    return this.diagnostic.checkpoints[this.diagnostic.checkpoints.length - 1];
  }

  /**
   * Ensure debug directory exists
   */
  private ensureDebugDirectory(): void {
    if (!existsSync(this.debugDir)) {
      mkdirSync(this.debugDir, { recursive: true });
    }
  }

  /**
   * Log message with optional formatting
   */
  private log(message: string, context?: Record<string, any>, level: 'info' | 'error' | 'debug' = 'info'): void {
    if (this.enableConsoleOutput) {
      const timestamp = new Date().toISOString();
      const contextStr = context ? ' ' + JSON.stringify(context) : '';
      
      switch (level) {
        case 'error':
          console.error(chalk.red(`[${timestamp}] ${message}${contextStr}`));
          break;
        case 'debug':
          console.debug(chalk.gray(`[${timestamp}] ${message}${contextStr}`));
          break;
        default:
          console.log(`[${timestamp}] ${message}${contextStr}`);
      }
    }
  }

  /**
   * Emit event for monitoring
   */
  private emitEvent(eventName: string, data: any): void {
    this.emit(eventName, {
      timestamp: Date.now(),
      activityId: this.activityId,
      ...data,
    });
  }

  /**
   * Finalize execution
   */
  finalize(): void {
    this.diagnostic.endTime = Date.now();
    this.diagnostic.duration = this.diagnostic.endTime - this.diagnostic.startTime;

    if (this.diagnostic.failures.length > 0) {
      this.analyzeRootCause();
    }

    this.log('🏁 Activity Execution Completed', {
      duration: this.diagnostic.duration,
      failures: this.diagnostic.failures.length,
      warnings: this.diagnostic.warnings.length,
    });
  }

  /**
   * Get diagnostic data
   */
  getDiagnostic(): ExecutionDiagnostic {
    return this.diagnostic;
  }

  /**
   * Get failures
   */
  getFailures(): ExecutionFailure[] {
    return this.diagnostic.failures;
  }

  /**
   * Check if execution was successful
   */
  isSuccessful(): boolean {
    return this.diagnostic.failures.length === 0;
  }
}

// ============================================================================
// CHECKPOINT HANDLE CLASS
// ============================================================================

class CheckpointHandle {
  constructor(
    private debugger: ActivityExecutionDebugger,
    private checkpoint: ActivityCheckpoint
  ) {}

  /**
   * Add assertion to checkpoint
   */
  assert(name: string, expected: any, actual?: any, reason?: string): this {
    this.debugger.assert(name, expected, actual, reason);
    return this;
  }

  /**
   * Record metrics
   */
  metrics(metrics: Record<string, number | string | boolean>): this {
    this.debugger.recordMetrics(metrics);
    return this;
  }

  /**
   * Mark checkpoint as complete
   */
  complete(state: ExecutionState = ExecutionState.SUCCESS): void {
    this.checkpoint.state = state;
  }

  /**
   * Get checkpoint data
   */
  getCheckpoint(): ActivityCheckpoint {
    return this.checkpoint;
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default ActivityExecutionDebugger;
