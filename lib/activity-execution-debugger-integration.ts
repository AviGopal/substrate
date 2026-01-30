/**
 * Activity Execution Debugger Integration
 * 
 * Example integration of the Activity Execution Debugger with the Activity system.
 * Demonstrates how to instrument activity execution with transparent failure diagnosis.
 */

import ActivityExecutionDebugger, {
  ExecutionPhase,
  ExecutionState,
  ExecutionDiagnostic,
  RootCauseAnalysis,
} from './activity-execution-debugger';

// ============================================================================
// INTEGRATION LAYER
// ============================================================================

/**
 * Wrapper for activity execution with comprehensive debugging
 */
export class DebuggedActivityExecutor {
  private debugger: ActivityExecutionDebugger;
  private activityMetrics: Map<string, number> = new Map();

  constructor(
    private activityId: string,
    private activityType: string,
    private outputDir: string = './.debug'
  ) {
    this.debugger = new ActivityExecutionDebugger(
      activityId,
      activityType,
      outputDir
    );

    this.setupEventListeners();
  }

  /**
   * Setup debugger event listeners for monitoring
   */
  private setupEventListeners(): void {
    // Log phase transitions
    this.debugger.on('phase_enter', (data) => {
      console.log(`\n→ [${data.phase}] ${data.description || ''}`);
    });

    this.debugger.on('phase_exit', (data) => {
      console.log(`← [${data.phase}] ${data.state} (${data.duration}ms)`);
    });

    // Alert on assertion failures
    this.debugger.on('assertion_failed', (data) => {
      console.error(`\n  ❌ ASSERTION FAILED: ${data.assertion.name}`);
      console.error(`     Expected: ${JSON.stringify(data.assertion.expected)}`);
      console.error(`     Actual: ${JSON.stringify(data.assertion.actual)}`);
      if (data.assertion.reason) {
        console.error(`     Reason: ${data.assertion.reason}`);
      }
    });

    // Alert on failures
    this.debugger.on('failure_recorded', (data) => {
      console.error(`\n⚠️  Failure recorded at checkpoint: ${data.checkpoint}`);
    });

    // Alert on warnings
    this.debugger.on('warning_recorded', (data) => {
      console.warn(`\n⚠️  Warning [${data.severity}]: ${data.message}`);
    });
  }

  /**
   * Execute initialization phase with debugging
   */
  async executeInitialization(
    validationFn: () => Promise<boolean>,
    description: string = 'Initialize activity'
  ): Promise<boolean> {
    this.debugger.enterPhase(ExecutionPhase.INITIALIZATION, description);

    try {
      const cp = this.debugger.checkpoint(
        'cp_init',
        'Validate initialization requirements'
      );

      const isValid = await this.debugger.timeOperation(
        'initialization',
        validationFn,
        5000
      );

      this.debugger.assertTrue('initialization_valid', isValid, 'Initialization must be valid');
      cp.complete(isValid ? ExecutionState.SUCCESS : ExecutionState.FAILED);

      this.debugger.exitPhase(isValid ? ExecutionState.SUCCESS : ExecutionState.FAILED);
      return isValid;
    } catch (error) {
      this.debugger.exitPhase(ExecutionState.FAILED);
      throw error;
    }
  }

  /**
   * Execute discovery phase with debugging
   */
  async executeDiscovery<T>(
    discoveryFn: () => Promise<T>,
    description: string = 'Discover patterns and templates'
  ): Promise<T> {
    this.debugger.enterPhase(ExecutionPhase.DISCOVERY, description);

    try {
      const cp = this.debugger.checkpoint(
        'cp_discovery',
        'Execute discovery'
      );

      const startTime = Date.now();
      const result = await this.debugger.timeOperation(
        'discovery',
        discoveryFn,
        10000
      );

      const duration = Date.now() - startTime;
      this.debugger.assertTrue('discovery_successful', result != null, 'Discovery must return results');

      cp
        .metrics({
          'discovery_time_ms': duration,
          'result_type': typeof result,
        })
        .complete(ExecutionState.SUCCESS);

      this.debugger.exitPhase(ExecutionState.SUCCESS);
      return result;
    } catch (error) {
      this.debugger.exitPhase(ExecutionState.FAILED);
      throw error;
    }
  }

  /**
   * Execute planning phase with debugging
   */
  async executePlanning<T>(
    planningFn: () => Promise<T>,
    description: string = 'Plan execution sequence'
  ): Promise<T> {
    this.debugger.enterPhase(ExecutionPhase.PLANNING, description);

    try {
      const cp = this.debugger.checkpoint(
        'cp_planning',
        'Create and validate execution plan'
      );

      const plan = await this.debugger.timeOperation(
        'planning',
        planningFn,
        5000
      );

      this.debugger.assertTrue('plan_created', plan != null, 'Plan must be created');

      cp
        .metrics({
          'plan_items': Array.isArray(plan) ? plan.length : 1,
        })
        .complete(ExecutionState.SUCCESS);

      this.debugger.exitPhase(ExecutionState.SUCCESS);
      return plan;
    } catch (error) {
      this.debugger.exitPhase(ExecutionState.FAILED);
      throw error;
    }
  }

  /**
   * Execute a single task with debugging
   */
  async executeTask(
    taskId: string,
    taskDescription: string,
    taskFn: () => Promise<any>
  ): Promise<any> {
    const checkpointId = `cp_task_${taskId}`;
    const cp = this.debugger.checkpoint(
      checkpointId,
      taskDescription
    );

    const startTime = Date.now();

    try {
      const result = await this.debugger.timeOperation(
        `task_${taskId}`,
        taskFn,
        30000  // 30 second timeout
      );

      const duration = Date.now() - startTime;

      this.debugger.assertTrue(
        `${taskId}_success`,
        result != null,
        `Task ${taskId} must return result`
      );

      this.activityMetrics.set(`${taskId}_duration_ms`, duration);

      cp
        .metrics({
          'duration_ms': duration,
          'status': 'SUCCESS',
        })
        .complete(ExecutionState.SUCCESS);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.activityMetrics.set(`${taskId}_duration_ms`, duration);

      cp
        .metrics({
          'duration_ms': duration,
          'status': 'FAILED',
          'error': error instanceof Error ? error.message : String(error),
        })
        .complete(ExecutionState.FAILED);

      throw error;
    }
  }

  /**
   * Execute all tasks with debugging
   */
  async executeTasks(
    tasks: Array<{ id: string; description: string; fn: () => Promise<any> }>,
    description: string = 'Execute activity tasks'
  ): Promise<any[]> {
    this.debugger.enterPhase(ExecutionPhase.EXECUTION, description);

    const results: any[] = [];

    try {
      for (const task of tasks) {
        const result = await this.executeTask(task.id, task.description, task.fn);
        results.push(result);
      }

      this.debugger.exitPhase(ExecutionState.SUCCESS);
      return results;
    } catch (error) {
      this.debugger.exitPhase(ExecutionState.FAILED);
      throw error;
    }
  }

  /**
   * Execute validation phase with debugging
   */
  async executeValidation(
    validationFn: () => Promise<ValidationResult>,
    description: string = 'Validate activity output'
  ): Promise<ValidationResult> {
    this.debugger.enterPhase(ExecutionPhase.VALIDATION, description);

    try {
      const cp = this.debugger.checkpoint(
        'cp_validation',
        'Run quality checks'
      );

      const result = await this.debugger.timeOperation(
        'validation',
        validationFn,
        60000  // 60 second timeout
      );

      // Assert validation criteria
      this.debugger.assertTrue('validation_passed', result.passed, 'Validation must pass');

      if (result.coverage !== undefined) {
        this.debugger.assert(
          'coverage_threshold',
          '>=80%',
          `${result.coverage}%`,
          `Coverage ${result.coverage}% must be >= 80%`
        );
      }

      if (result.errors && result.errors.length > 0) {
        this.debugger.assertEqual(
          'no_errors',
          0,
          result.errors.length,
          `Expected 0 errors but got ${result.errors.length}`
        );
      }

      cp
        .metrics({
          'coverage_percent': result.coverage || 0,
          'error_count': result.errors?.length || 0,
          'warning_count': result.warnings?.length || 0,
        })
        .complete(result.passed ? ExecutionState.SUCCESS : ExecutionState.FAILED);

      this.debugger.exitPhase(
        result.passed ? ExecutionState.SUCCESS : ExecutionState.FAILED
      );

      return result;
    } catch (error) {
      this.debugger.exitPhase(ExecutionState.FAILED);
      throw error;
    }
  }

  /**
   * Execute completion phase with debugging
   */
  async executeCompletion(
    completionFn: () => Promise<any>,
    description: string = 'Finalize activity'
  ): Promise<any> {
    this.debugger.enterPhase(ExecutionPhase.COMPLETION, description);

    try {
      const cp = this.debugger.checkpoint(
        'cp_completion',
        'Complete activity'
      );

      const result = await this.debugger.timeOperation(
        'completion',
        completionFn,
        10000
      );

      this.debugger.assertTrue('completion_successful', result != null, 'Completion must succeed');

      cp
        .metrics({
          'completion_result': typeof result,
        })
        .complete(ExecutionState.SUCCESS);

      this.debugger.exitPhase(ExecutionState.SUCCESS);
      return result;
    } catch (error) {
      this.debugger.exitPhase(ExecutionState.FAILED);
      throw error;
    }
  }

  /**
   * Execute error recovery phase
   */
  async executeErrorRecovery(
    error: Error,
    recoveryFn: () => Promise<void>
  ): Promise<void> {
    this.debugger.enterPhase(ExecutionPhase.ERROR_RECOVERY, 'Recover from error');

    try {
      const cp = this.debugger.checkpoint(
        'cp_error_recovery',
        'Execute error recovery'
      );

      console.error('\n❌ ERROR OCCURRED:');
      console.error(`   ${error.message}`);
      console.error(error.stack || '');

      await recoveryFn();

      cp.complete(ExecutionState.SUCCESS);
      this.debugger.exitPhase(ExecutionState.SUCCESS);
    } catch (recoveryError) {
      console.error('\n❌ ERROR RECOVERY FAILED:');
      console.error(recoveryError instanceof Error ? recoveryError.message : String(recoveryError));

      this.debugger.exitPhase(ExecutionState.FAILED);
    }
  }

  /**
   * Finalize execution and generate reports
   */
  finalize(): ExecutionDiagnostic {
    this.debugger.finalize();
    return this.debugger.getDiagnostic();
  }

  /**
   * Get root cause analysis if execution failed
   */
  getRootCauseAnalysis(): RootCauseAnalysis | undefined {
    return this.debugger.analyzeRootCause();
  }

  /**
   * Check if execution was successful
   */
  isSuccessful(): boolean {
    return this.debugger.isSuccessful();
  }

  /**
   * Print execution report
   */
  printReport(includeTimeline: boolean = true): void {
    const report = this.debugger.generateReport();
    console.log('\n' + report);

    if (includeTimeline) {
      const diagnostic = this.debugger.getDiagnostic();
      console.log('\nTOTAL EXECUTION TIME:');
      if (diagnostic.duration) {
        const seconds = Math.round(diagnostic.duration / 1000);
        console.log(`  ${diagnostic.duration}ms (${seconds}s)`);
      }
    }
  }

  /**
   * Save execution reports
   */
  saveReports(): { text: string; json: string } {
    const textReport = this.debugger.saveReport('text');
    const jsonReport = this.debugger.saveReport('json');

    console.log(`\n📄 Reports saved:`);
    console.log(`   Text: ${textReport}`);
    console.log(`   JSON: ${jsonReport}`);

    return { text: textReport, json: jsonReport };
  }

  /**
   * Get execution diagnostic
   */
  getDiagnostic(): ExecutionDiagnostic {
    return this.debugger.getDiagnostic();
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ValidationResult {
  passed: boolean;
  coverage?: number;
  errors?: string[];
  warnings?: string[];
  details?: Record<string, any>;
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/**
 * Example: Execute a feature activity with full debugging
 */
export async function executeFeatureActivityWithDebugging(
  activityId: string,
  activityType: string
): Promise<ExecutionDiagnostic> {
  const executor = new DebuggedActivityExecutor(
    activityId,
    activityType,
    './.debug/activities'
  );

  try {
    // Initialization
    console.log('\n🚀 Starting activity execution with debugging...\n');

    await executor.executeInitialization(
      async () => {
        // Validate environment, templates, etc.
        return true;
      },
      'Setup activity environment'
    );

    // Discovery
    const templates = await executor.executeDiscovery(
      async () => {
        // Search for templates and patterns
        return { templates: [], patterns: [] };
      },
      'Search for activity templates'
    );

    // Planning
    const plan = await executor.executePlanning(
      async () => {
        // Create execution plan
        return { tasks: [], dependencies: [] };
      },
      'Create task execution plan'
    );

    // Execution
    const results = await executor.executeTasks(
      [
        {
          id: 'task_1',
          description: 'Implement feature logic',
          fn: async () => {
            // Task execution
            return { success: true };
          },
        },
        {
          id: 'task_2',
          description: 'Add tests',
          fn: async () => {
            // Task execution
            return { success: true };
          },
        },
      ],
      'Execute activity tasks'
    );

    // Validation
    const validation = await executor.executeValidation(
      async () => {
        // Run quality checks
        return {
          passed: true,
          coverage: 85,
          errors: [],
          warnings: [],
        };
      },
      'Validate output quality'
    );

    // Completion
    await executor.executeCompletion(
      async () => {
        // Commit, tag, etc.
        return { success: true };
      },
      'Commit and finalize'
    );

    // Finalize and report
    console.log('\n✅ Activity execution completed successfully!\n');

    const diagnostic = executor.finalize();
    executor.printReport(true);
    executor.saveReports();

    return diagnostic;
  } catch (error) {
    // Error handling
    console.error('\n❌ Activity execution failed!\n');

    try {
      await executor.executeErrorRecovery(
        error instanceof Error ? error : new Error(String(error)),
        async () => {
          // Cleanup, rollback, etc.
        }
      );
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
    }

    const diagnostic = executor.finalize();

    // Print diagnostic report
    executor.printReport(true);
    executor.saveReports();

    // Print root cause analysis
    const rootCause = executor.getRootCauseAnalysis();
    if (rootCause) {
      console.log('\nROOT CAUSE ANALYSIS:');
      console.log(`  Failure Point: ${rootCause.failurePoint}`);
      console.log(`  Immediate Reason: ${rootCause.immediateReason}`);
      console.log('  Contributing Factors:');
      rootCause.contributingFactors.forEach((f) => console.log(`    - ${f}`));
      console.log('  Prevention Strategies:');
      rootCause.preventionStrategies.forEach((s) => console.log(`    - ${s}`));
    }

    throw error;
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default DebuggedActivityExecutor;
