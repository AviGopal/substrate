/**
 * Log Pattern Analyzer for External Activity System Validation
 * 
 * Analyzes captured logs to detect:
 * - Activity lifecycle patterns
 * - Session-aware tool calls (root vs child sessions)
 * - Forbidden direct tool calls in root session
 * - Expected patterns per scenario
 * 
 * This is the core validation component that proves activity-only execution.
 */

export interface LogPattern {
  pattern: string | RegExp;
  description: string;
  severity: 'required' | 'optional' | 'expected' | 'critical';
}

export interface PatternMatch {
  pattern: LogPattern;
  matched: boolean;
  matchedLines: string[];
  lineNumbers: number[];
}

export interface SessionContext {
  sessionId: string;
  sessionType: 'root' | 'activity-child' | 'unknown';
  toolCalls: string[];
}

export interface LogAnalysisResult {
  scenario: string;
  totalLines: number;
  patternsAnalyzed: number;
  requiredPatternsFound: PatternMatch[];
  optionalPatternsFound: PatternMatch[];
  forbiddenPatternsFound: PatternMatch[];
  sessionContexts: SessionContext[];
  validationErrors: string[];
  passed: boolean;
  evidence: {
    activityLifecycle: boolean;
    sessionIsolation: boolean;
    noDirectToolCalls: boolean;
    allRequiredPresent: boolean;
  };
}

/**
 * Analyzes logs for a specific scenario
 */
export class LogAnalyzer {
  private logs: string[];
  private sessionContexts: Map<string, SessionContext> = new Map();

  constructor(logs: string[]) {
    this.logs = logs;
    this.extractSessionContexts();
  }

  /**
   * Extract session contexts from logs to track tool calls per session
   */
  private extractSessionContexts(): void {
    // Patterns to identify sessions
    const sessionCreatePattern = /Session created.*sessionID:\s*(\S+)/;
    const toolCallPattern = /(bash|read|edit|write|glob|grep).*tool.*called.*sessionID:\s*(\S+)/;

    this.logs.forEach((line) => {
      // Track session creation
      const sessionMatch = line.match(sessionCreatePattern);
      if (sessionMatch) {
        const sessionId = sessionMatch[1];
        const sessionType = sessionId.startsWith('activity-') 
          ? 'activity-child' 
          : sessionId === 'root-session' || sessionId === 'root'
          ? 'root'
          : 'unknown';

        this.sessionContexts.set(sessionId, {
          sessionId,
          sessionType,
          toolCalls: [],
        });
      }

      // Track tool calls per session
      const toolMatch = line.match(toolCallPattern);
      if (toolMatch) {
        const toolName = toolMatch[1];
        const sessionId = toolMatch[2];

        if (!this.sessionContexts.has(sessionId)) {
          // Infer session type from ID
          const sessionType = sessionId.startsWith('activity-')
            ? 'activity-child'
            : sessionId === 'root-session' || sessionId === 'root'
            ? 'root'
            : 'unknown';

          this.sessionContexts.set(sessionId, {
            sessionId,
            sessionType,
            toolCalls: [],
          });
        }

        const context = this.sessionContexts.get(sessionId)!;
        context.toolCalls.push(`${toolName} (line: ${line})`);
      }
    });
  }

  /**
   * Match a single pattern against logs
   */
  private matchPattern(logPattern: LogPattern): PatternMatch {
    const regex = typeof logPattern.pattern === 'string' 
      ? new RegExp(logPattern.pattern)
      : logPattern.pattern;

    const matchedLines: string[] = [];
    const lineNumbers: number[] = [];

    this.logs.forEach((line, index) => {
      if (regex.test(line)) {
        matchedLines.push(line);
        lineNumbers.push(index + 1);
      }
    });

    return {
      pattern: logPattern,
      matched: matchedLines.length > 0,
      matchedLines,
      lineNumbers,
    };
  }

  /**
   * Analyze logs against scenario patterns
   */
  analyze(
    requiredPatterns: LogPattern[],
    forbiddenPatterns: LogPattern[],
    optionalPatterns: LogPattern[] = [],
    scenarioId: string = 'unknown'
  ): LogAnalysisResult {
    const requiredMatches = requiredPatterns.map(p => this.matchPattern(p));
    const forbiddenMatches = forbiddenPatterns.map(p => this.matchPattern(p));
    const optionalMatches = optionalPatterns.map(p => this.matchPattern(p));

    const validationErrors: string[] = [];

    // Check required patterns
    const missingRequired = requiredMatches.filter(m => !m.matched);
    if (missingRequired.length > 0) {
      validationErrors.push(
        `Missing ${missingRequired.length} required pattern(s): ${
          missingRequired.map(m => m.pattern.description).join(', ')
        }`
      );
    }

    // Check forbidden patterns
    const foundForbidden = forbiddenMatches.filter(m => m.matched);
    if (foundForbidden.length > 0) {
      validationErrors.push(
        `Found ${foundForbidden.length} FORBIDDEN pattern(s): ${
          foundForbidden.map(m => 
            `${m.pattern.description} (${m.matchedLines.length} occurrence(s))`
          ).join(', ')
        }`
      );
    }

    // Validate session isolation
    const rootSessionCalls = this.getToolCallsInRootSession();
    const sessionIsolationValid = rootSessionCalls.length === 0;

    if (!sessionIsolationValid) {
      validationErrors.push(
        `Found ${rootSessionCalls.length} direct tool call(s) in root session: ${
          rootSessionCalls.slice(0, 3).join(', ')
        }${rootSessionCalls.length > 3 ? '...' : ''}`
      );
    }

    // Check activity lifecycle (for execution scenarios)
    const lifecyclePatterns = [
      'Activity.*starting',
      'Memory agent initializing',
      'Task.*starting',
      'Task.*completed',
      'Activity.*completed',
    ];

    const lifecyclePresent = lifecyclePatterns.every(pattern => 
      this.logs.some(line => new RegExp(pattern).test(line))
    );

    const allRequiredPresent = missingRequired.length === 0;
    const noForbiddenPresent = foundForbidden.length === 0;

    const passed = allRequiredPresent && noForbiddenPresent && sessionIsolationValid;

    return {
      scenario: scenarioId,
      totalLines: this.logs.length,
      patternsAnalyzed: requiredPatterns.length + forbiddenPatterns.length + optionalPatterns.length,
      requiredPatternsFound: requiredMatches,
      optionalPatternsFound: optionalMatches,
      forbiddenPatternsFound: forbiddenMatches,
      sessionContexts: Array.from(this.sessionContexts.values()),
      validationErrors,
      passed,
      evidence: {
        activityLifecycle: lifecyclePresent,
        sessionIsolation: sessionIsolationValid,
        noDirectToolCalls: rootSessionCalls.length === 0,
        allRequiredPresent,
      },
    };
  }

  /**
   * Get all tool calls that occurred in root session (FORBIDDEN)
   */
  private getToolCallsInRootSession(): string[] {
    const rootCalls: string[] = [];

    for (const context of this.sessionContexts.values()) {
      if (context.sessionType === 'root') {
        rootCalls.push(...context.toolCalls);
      }
    }

    return rootCalls;
  }

  /**
   * Get all tool calls in activity child sessions (ALLOWED)
   */
  getToolCallsInActivitySessions(): string[] {
    const activityCalls: string[] = [];

    for (const context of this.sessionContexts.values()) {
      if (context.sessionType === 'activity-child') {
        activityCalls.push(...context.toolCalls);
      }
    }

    return activityCalls;
  }

  /**
   * Generate detailed evidence report
   */
  generateEvidenceReport(result: LogAnalysisResult): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push(`LOG ANALYSIS EVIDENCE REPORT - Scenario: ${result.scenario}`);
    lines.push('='.repeat(80));
    lines.push('');

    // Summary
    lines.push('SUMMARY:');
    lines.push(`  Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}`);
    lines.push(`  Total log lines analyzed: ${result.totalLines}`);
    lines.push(`  Patterns analyzed: ${result.patternsAnalyzed}`);
    lines.push(`  Validation errors: ${result.validationErrors.length}`);
    lines.push('');

    // Evidence
    lines.push('EVIDENCE:');
    lines.push(`  ✓ Activity lifecycle present: ${result.evidence.activityLifecycle ? 'YES' : 'NO'}`);
    lines.push(`  ✓ Session isolation maintained: ${result.evidence.sessionIsolation ? 'YES' : 'NO'}`);
    lines.push(`  ✓ No direct tool calls in root: ${result.evidence.noDirectToolCalls ? 'YES' : 'NO'}`);
    lines.push(`  ✓ All required patterns found: ${result.evidence.allRequiredPresent ? 'YES' : 'NO'}`);
    lines.push('');

    // Required patterns
    lines.push('REQUIRED PATTERNS:');
    result.requiredPatternsFound.forEach((match) => {
      const status = match.matched ? '✅' : '❌';
      lines.push(`  ${status} ${match.pattern.description}`);
      if (match.matched) {
        lines.push(`     Found at lines: ${match.lineNumbers.slice(0, 5).join(', ')}`);
      }
    });
    lines.push('');

    // Forbidden patterns
    lines.push('FORBIDDEN PATTERNS:');
    result.forbiddenPatternsFound.forEach((match) => {
      const status = match.matched ? '❌ VIOLATION' : '✅';
      lines.push(`  ${status} ${match.pattern.description}`);
      if (match.matched) {
        lines.push(`     FOUND at lines: ${match.lineNumbers.join(', ')}`);
        lines.push(`     Evidence:`);
        match.matchedLines.slice(0, 3).forEach(line => {
          lines.push(`       ${line.substring(0, 100)}`);
        });
      }
    });
    lines.push('');

    // Session contexts
    lines.push('SESSION CONTEXTS:');
    result.sessionContexts.forEach((ctx) => {
      lines.push(`  Session: ${ctx.sessionId} (${ctx.sessionType})`);
      lines.push(`    Tool calls: ${ctx.toolCalls.length}`);
      if (ctx.toolCalls.length > 0) {
        ctx.toolCalls.slice(0, 3).forEach(call => {
          lines.push(`      - ${call}`);
        });
        if (ctx.toolCalls.length > 3) {
          lines.push(`      ... and ${ctx.toolCalls.length - 3} more`);
        }
      }
    });
    lines.push('');

    // Validation errors
    if (result.validationErrors.length > 0) {
      lines.push('VALIDATION ERRORS:');
      result.validationErrors.forEach((error) => {
        lines.push(`  ❌ ${error}`);
      });
      lines.push('');
    }

    lines.push('='.repeat(80));

    return lines.join('\n');
  }

  /**
   * Export analysis results as JSON
   */
  exportAsJSON(result: LogAnalysisResult): string {
    return JSON.stringify(result, null, 2);
  }
}

/**
 * Helper to create LogPattern from scenario definition
 */
export function createLogPattern(
  pattern: string | RegExp,
  description: string,
  severity: 'required' | 'optional' | 'expected' | 'critical' = 'required'
): LogPattern {
  return { pattern, description, severity };
}

// Note: File loading functionality should be implemented in the shell script
// This module focuses on log analysis logic only
