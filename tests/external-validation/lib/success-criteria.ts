/**
 * Success Criteria Validator for External Activity System Validation
 * 
 * Validates test scenarios against defined success criteria:
 * - All required patterns found
 * - No forbidden patterns found
 * - Session isolation maintained
 * - Activity lifecycle complete
 * - Execution time within bounds
 */

import { LogAnalyzer, LogPattern, LogAnalysisResult } from './log-analyzer';

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  command: string;
  expectedPatterns: Array<{
    pattern: string;
    description: string;
    severity: 'required' | 'optional';
  }>;
  forbiddenPatterns: Array<{
    pattern: string;
    description: string;
    severity: 'critical';
  }>;
  allowedPatterns?: Array<{
    pattern: string;
    description: string;
    severity: 'expected';
  }>;
  successCriteria: {
    allRequiredPatternsFound: boolean;
    noForbiddenPatternsFound: boolean;
    allLifecyclePatternsFound?: boolean;
    toolCallsInChildSessionOnly?: boolean;
    templateCreated?: boolean;
    templateNotExecuted?: boolean;
    exitCode: number;
    executionTime: {
      max: number;
      unit: string;
    };
  };
}

export interface ValidationResult {
  scenario: ScenarioDefinition;
  passed: boolean;
  criteriaResults: {
    [key: string]: {
      expected: boolean | number;
      actual: boolean | number | string;
      passed: boolean;
      message: string;
    };
  };
  logAnalysis: LogAnalysisResult;
  executionMetrics: {
    exitCode: number;
    executionTime: number;
    logLines: number;
  };
  summary: string;
}

export class SuccessCriteriaValidator {
  /**
   * Validate a scenario against its success criteria
   */
  static validateScenario(
    scenario: ScenarioDefinition,
    logs: string[],
    exitCode: number,
    executionTime: number
  ): ValidationResult {
    // Convert scenario patterns to LogPattern format
    const requiredPatterns: LogPattern[] = scenario.expectedPatterns
      .filter(p => p.severity === 'required')
      .map(p => ({
        pattern: new RegExp(p.pattern),
        description: p.description,
        severity: 'required' as const,
      }));

    const forbiddenPatterns: LogPattern[] = scenario.forbiddenPatterns.map(p => ({
      pattern: new RegExp(p.pattern),
      description: p.description,
      severity: 'critical' as const,
    }));

    const optionalPatterns: LogPattern[] = scenario.expectedPatterns
      .filter(p => p.severity === 'optional')
      .map(p => ({
        pattern: new RegExp(p.pattern),
        description: p.description,
        severity: 'optional' as const,
      }));

    // Run log analysis
    const analyzer = new LogAnalyzer(logs);
    const logAnalysis = analyzer.analyze(
      requiredPatterns,
      forbiddenPatterns,
      optionalPatterns,
      scenario.id
    );

    // Validate each criterion
    const criteriaResults: ValidationResult['criteriaResults'] = {};

    // 1. All required patterns found
    criteriaResults.allRequiredPatternsFound = {
      expected: scenario.successCriteria.allRequiredPatternsFound,
      actual: logAnalysis.evidence.allRequiredPresent,
      passed: logAnalysis.evidence.allRequiredPresent === scenario.successCriteria.allRequiredPatternsFound,
      message: logAnalysis.evidence.allRequiredPresent
        ? 'All required patterns found in logs'
        : `Missing ${logAnalysis.requiredPatternsFound.filter(p => !p.matched).length} required pattern(s)`,
    };

    // 2. No forbidden patterns found
    criteriaResults.noForbiddenPatternsFound = {
      expected: scenario.successCriteria.noForbiddenPatternsFound,
      actual: logAnalysis.evidence.noDirectToolCalls,
      passed: logAnalysis.evidence.noDirectToolCalls === scenario.successCriteria.noForbiddenPatternsFound,
      message: logAnalysis.evidence.noDirectToolCalls
        ? 'No forbidden patterns found in logs'
        : `Found ${logAnalysis.forbiddenPatternsFound.filter(p => p.matched).length} forbidden pattern(s)`,
    };

    // 3. Exit code
    criteriaResults.exitCode = {
      expected: scenario.successCriteria.exitCode,
      actual: exitCode,
      passed: exitCode === scenario.successCriteria.exitCode,
      message: exitCode === 0 ? 'Command exited successfully' : `Command failed with exit code ${exitCode}`,
    };

    // 4. Execution time
    const maxTime = scenario.successCriteria.executionTime.max;
    criteriaResults.executionTime = {
      expected: maxTime,
      actual: executionTime,
      passed: executionTime <= maxTime,
      message: executionTime <= maxTime
        ? `Executed in ${executionTime}ms (within ${maxTime}ms limit)`
        : `Execution took ${executionTime}ms (exceeded ${maxTime}ms limit)`,
    };

    // 5. Activity lifecycle (if required)
    if (scenario.successCriteria.allLifecyclePatternsFound !== undefined) {
      criteriaResults.allLifecyclePatternsFound = {
        expected: scenario.successCriteria.allLifecyclePatternsFound,
        actual: logAnalysis.evidence.activityLifecycle,
        passed: logAnalysis.evidence.activityLifecycle === scenario.successCriteria.allLifecyclePatternsFound,
        message: logAnalysis.evidence.activityLifecycle
          ? 'Activity lifecycle patterns present'
          : 'Activity lifecycle incomplete',
      };
    }

    // 6. Session isolation (if required)
    if (scenario.successCriteria.toolCallsInChildSessionOnly !== undefined) {
      criteriaResults.toolCallsInChildSessionOnly = {
        expected: scenario.successCriteria.toolCallsInChildSessionOnly,
        actual: logAnalysis.evidence.sessionIsolation,
        passed: logAnalysis.evidence.sessionIsolation === scenario.successCriteria.toolCallsInChildSessionOnly,
        message: logAnalysis.evidence.sessionIsolation
          ? 'Tool calls only in activity child sessions'
          : 'Found tool calls in root session (VIOLATION)',
      };
    }

    // 7. Template created (if required)
    if (scenario.successCriteria.templateCreated !== undefined) {
      const templateCreated = logs.some(line =>
        /Template.*created|template_created/.test(line)
      );
      criteriaResults.templateCreated = {
        expected: scenario.successCriteria.templateCreated,
        actual: templateCreated,
        passed: templateCreated === scenario.successCriteria.templateCreated,
        message: templateCreated ? 'Template created successfully' : 'Template not created',
      };
    }

    // 8. Template not executed (if required)
    if (scenario.successCriteria.templateNotExecuted !== undefined) {
      const templateExecuted = logs.some(line =>
        /Activity.*starting/.test(line)
      );
      const templateNotExecuted = !templateExecuted;
      criteriaResults.templateNotExecuted = {
        expected: scenario.successCriteria.templateNotExecuted,
        actual: templateNotExecuted,
        passed: templateNotExecuted === scenario.successCriteria.templateNotExecuted,
        message: templateNotExecuted
          ? 'Template not executed (as expected for creation scenario)'
          : 'Template was executed (should NOT happen in creation scenario)',
      };
    }

    // Determine overall pass/fail
    const allCriteriaPassed = Object.values(criteriaResults).every(result => result.passed);
    const passed = allCriteriaPassed && logAnalysis.passed;

    // Generate summary
    const summary = this.generateSummary(scenario, passed, criteriaResults, logAnalysis);

    return {
      scenario,
      passed,
      criteriaResults,
      logAnalysis,
      executionMetrics: {
        exitCode,
        executionTime,
        logLines: logs.length,
      },
      summary,
    };
  }

  /**
   * Generate human-readable summary
   */
  private static generateSummary(
    scenario: ScenarioDefinition,
    passed: boolean,
    criteria: ValidationResult['criteriaResults'],
    logAnalysis: LogAnalysisResult
  ): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push(`SCENARIO: ${scenario.name} (${scenario.id})`);
    lines.push(`RESULT: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    lines.push('='.repeat(80));
    lines.push('');

    lines.push('CRITERIA EVALUATION:');
    Object.entries(criteria).forEach(([key, result]) => {
      const status = result.passed ? '✅' : '❌';
      lines.push(`  ${status} ${key}: ${result.message}`);
    });
    lines.push('');

    if (!passed) {
      lines.push('FAILURES:');
      Object.entries(criteria)
        .filter(([, result]) => !result.passed)
        .forEach(([key, result]) => {
          lines.push(`  ❌ ${key}`);
          lines.push(`     Expected: ${result.expected}`);
          lines.push(`     Actual: ${result.actual}`);
          lines.push(`     ${result.message}`);
        });
      lines.push('');

      if (logAnalysis.validationErrors.length > 0) {
        lines.push('LOG VALIDATION ERRORS:');
        logAnalysis.validationErrors.forEach(error => {
          lines.push(`  • ${error}`);
        });
        lines.push('');
      }
    }

    lines.push('='.repeat(80));

    return lines.join('\n');
  }

  /**
   * Validate all scenarios and generate aggregate report
   */
  static validateAll(scenarioResults: ValidationResult[]): {
    passed: boolean;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    report: string;
  } {
    const totalScenarios = scenarioResults.length;
    const passedScenarios = scenarioResults.filter(r => r.passed).length;
    const failedScenarios = totalScenarios - passedScenarios;
    const passed = failedScenarios === 0;

    const lines: string[] = [];

    lines.push('');
    lines.push('='.repeat(80));
    lines.push('EXTERNAL ACTIVITY SYSTEM VALIDATION - AGGREGATE REPORT');
    lines.push('='.repeat(80));
    lines.push('');

    lines.push(`OVERALL RESULT: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    lines.push(`Total scenarios: ${totalScenarios}`);
    lines.push(`Passed: ${passedScenarios}`);
    lines.push(`Failed: ${failedScenarios}`);
    lines.push('');

    lines.push('SCENARIO RESULTS:');
    scenarioResults.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      lines.push(`  ${status} ${result.scenario.name}`);
    });
    lines.push('');

    if (failedScenarios > 0) {
      lines.push('FAILED SCENARIOS DETAIL:');
      scenarioResults
        .filter(r => !r.passed)
        .forEach(result => {
          lines.push('');
          lines.push(`  Scenario: ${result.scenario.name}`);
          lines.push(`  Reason:`);
          Object.entries(result.criteriaResults)
            .filter(([, r]) => !r.passed)
            .forEach(([key, r]) => {
              lines.push(`    - ${key}: ${r.message}`);
            });
        });
      lines.push('');
    }

    lines.push('='.repeat(80));

    return {
      passed,
      totalScenarios,
      passedScenarios,
      failedScenarios,
      report: lines.join('\n'),
    };
  }
}
