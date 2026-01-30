/**
 * Activity Failure Detection System
 * 
 * Automatically detects and handles failure conditions in activities
 * to prevent bad code commits and ensure quality standards.
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface FailureCondition {
  condition: string;
  description: string;
  threshold?: string;
  indicators?: string[];
  action: string;
  reason: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  check_command: string;
  remediation: string;
}

interface SoftFailureCondition extends FailureCondition {
  // Soft failures allow manual override
}

interface FailureReason {
  condition: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  remediation: string;
  checkCommand: string;
  output?: string;
}

interface ActivityMetrics {
  testCoverage: number;
  newCriticalIssues: number;
  testFailures: number;
  deadCodeLines: number;
  memoryUsageChange: number;
  buildErrors: number;
  lintingErrors: number;
  securityVulnerabilities: number;
  apiBreakingChanges: number;
}

interface Activity {
  id: string;
  type: 'fix' | 'feature' | 'bugfix' | 'refactor' | 'security';
  output: string;
  metrics: ActivityMetrics;
  files: string[];
  status: 'running' | 'completed' | 'failed';
}

interface FailureConfig {
  automatic_failures: FailureCondition[];
  soft_failures: SoftFailureCondition[];
  failure_detection_config: {
    check_order: string[];
    fail_fast: boolean;
    stop_on_first_critical: boolean;
    collect_all_failures: boolean;
    timeout_seconds: number;
    retry_flaky_checks: number;
  };
  activity_specific_conditions: Record<string, {
    required_checks: string[];
    optional_checks: string[];
  }>;
}

export class ActivityFailureDetector {
  private config: FailureConfig;
  private projectRoot: string;

  constructor(configPath?: string, projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    const configFile = configPath || join(this.projectRoot, '.activity-failure-conditions.json');
    
    if (!existsSync(configFile)) {
      throw new Error(`Failure conditions config not found: ${configFile}`);
    }

    this.config = JSON.parse(readFileSync(configFile, 'utf-8'));
  }

  /**
   * Check activity for failure conditions
   */
  async checkActivityFailureConditions(activity: Activity): Promise<FailureReason[]> {
    console.log(`🔍 Checking failure conditions for ${activity.type} activity: ${activity.id}`);
    
    const failures: FailureReason[] = [];
    const activityConfig = this.config.activity_specific_conditions[activity.type];
    
    if (!activityConfig) {
      console.warn(`⚠️  No specific failure conditions defined for activity type: ${activity.type}`);
      return failures;
    }

    // Get applicable checks for this activity type
    const requiredChecks = activityConfig.required_checks;
    const optionalChecks = activityConfig.optional_checks;
    const allChecks = [...requiredChecks, ...optionalChecks];

    // Filter conditions to only those applicable to this activity
    const applicableConditions = this.config.automatic_failures.filter(
      condition => allChecks.includes(condition.condition)
    );

    // Sort by check order if specified
    applicableConditions.sort((a, b) => {
      const orderA = this.config.failure_detection_config.check_order.indexOf(a.condition);
      const orderB = this.config.failure_detection_config.check_order.indexOf(b.condition);
      return orderA - orderB;
    });

    for (const condition of applicableConditions) {
      try {
        console.log(`  Checking: ${condition.condition}`);
        const failure = await this.checkCondition(condition, activity);
        
        if (failure) {
          failures.push(failure);
          console.log(`  ❌ ${failure.severity}: ${failure.message}`);
          
          // Stop on first critical if configured
          if (this.config.failure_detection_config.stop_on_first_critical && 
              failure.severity === 'CRITICAL') {
            break;
          }
        } else {
          console.log(`  ✅ ${condition.condition}: OK`);
        }
      } catch (error) {
        console.error(`  ⚠️  Error checking ${condition.condition}: ${error.message}`);
        // Continue with other checks unless fail_fast is enabled
        if (this.config.failure_detection_config.fail_fast) {
          failures.push({
            condition: condition.condition,
            severity: 'HIGH',
            message: `Check failed with error: ${error.message}`,
            remediation: 'Fix the check command or system configuration',
            checkCommand: condition.check_command
          });
        }
      }
    }

    // Check soft failures if no critical failures
    if (!failures.some(f => f.severity === 'CRITICAL')) {
      const softFailures = await this.checkSoftFailures(activity);
      failures.push(...softFailures);
    }

    return failures;
  }

  /**
   * Check a specific failure condition
   */
  private async checkCondition(condition: FailureCondition, activity: Activity): Promise<FailureReason | null> {
    switch (condition.condition) {
      case 'requires_user_input':
        return this.checkUserInputRequired(condition, activity);
      
      case 'test_coverage_drop':
        return this.checkTestCoverage(condition, activity);
      
      case 'new_critical_issues':
        return this.checkCriticalIssues(condition, activity);
      
      case 'dead_code_added':
        return this.checkDeadCode(condition, activity);
      
      case 'test_failures':
        return this.checkTestFailures(condition, activity);
      
      case 'fix_ineffective':
        return this.checkFixEffectiveness(condition, activity);
      
      case 'security_vulnerabilities':
        return this.checkSecurityVulnerabilities(condition, activity);
      
      case 'breaking_changes_unversioned':
        return this.checkBreakingChanges(condition, activity);
      
      case 'memory_regression':
        return this.checkMemoryRegression(condition, activity);
      
      case 'build_failures':
        return this.checkBuildFailures(condition, activity);
      
      case 'linting_failures':
        return this.checkLintingFailures(condition, activity);
      
      default:
        console.warn(`Unknown failure condition: ${condition.condition}`);
        return null;
    }
  }

  /**
   * Check if activity requires user input
   */
  private checkUserInputRequired(condition: FailureCondition, activity: Activity): FailureReason | null {
    const indicators = condition.indicators || [];
    
    for (const indicator of indicators) {
      const regex = new RegExp(indicator, 'i');
      if (regex.test(activity.output)) {
        return {
          condition: condition.condition,
          severity: condition.severity,
          message: `Activity requires user input - found indicator: "${indicator}"`,
          remediation: condition.remediation,
          checkCommand: condition.check_command,
          output: activity.output
        };
      }
    }

    // Also check files for manual intervention markers
    try {
      const output = execSync(condition.check_command, { 
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: this.config.failure_detection_config.timeout_seconds * 1000
      });
      
      if (output.trim()) {
        return {
          condition: condition.condition,
          severity: condition.severity,
          message: `Manual intervention markers found in codebase`,
          remediation: condition.remediation,
          checkCommand: condition.check_command,
          output: output.trim()
        };
      }
    } catch (error) {
      // Command failed, which might indicate no matches found (good)
      if (error.status === 1) {
        return null; // grep returns 1 when no matches found
      }
      throw error;
    }

    return null;
  }

  /**
   * Check test coverage
   */
  private checkTestCoverage(condition: FailureCondition, activity: Activity): FailureReason | null {
    if (activity.metrics.testCoverage < 0.80) {
      return {
        condition: condition.condition,
        severity: condition.severity,
        message: `Test coverage ${(activity.metrics.testCoverage * 100).toFixed(1)}% < 80%`,
        remediation: condition.remediation,
        checkCommand: condition.check_command
      };
    }
    return null;
  }

  /**
   * Check for new critical issues
   */
  private checkCriticalIssues(condition: FailureCondition, activity: Activity): FailureReason | null {
    if (activity.metrics.newCriticalIssues > 0) {
      return {
        condition: condition.condition,
        severity: condition.severity,
        message: `${activity.metrics.newCriticalIssues} new critical Metabob issues introduced`,
        remediation: condition.remediation,
        checkCommand: condition.check_command
      };
    }
    return null;
  }

  /**
   * Check for dead code
   */
  private checkDeadCode(condition: FailureCondition, activity: Activity): FailureReason | null {
    if (activity.metrics.deadCodeLines > 0) {
      return {
        condition: condition.condition,
        severity: condition.severity,
        message: `${activity.metrics.deadCodeLines} lines of dead code added`,
        remediation: condition.remediation,
        checkCommand: condition.check_command
      };
    }
    return null;
  }

  /**
   * Check for test failures
   */
  private checkTestFailures(condition: FailureCondition, activity: Activity): FailureReason | null {
    if (activity.metrics.testFailures > 0) {
      return {
        condition: condition.condition,
        severity: condition.severity,
        message: `${activity.metrics.testFailures} tests failing`,
        remediation: condition.remediation,
        checkCommand: condition.check_command
      };
    }
    return null;
  }

  /**
   * Check if fix is effective (for bugfix activities)
   */
  private checkFixEffectiveness(condition: FailureCondition, activity: Activity): FailureReason | null {
    if (activity.type !== 'bugfix' && activity.type !== 'fix') {
      return null; // Only applicable to fix activities
    }

    try {
      // Try to run reproducer test - should pass if fix is effective
      execSync(condition.check_command, { 
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: this.config.failure_detection_config.timeout_seconds * 1000
      });
      return null; // Test passed, fix is effective
    } catch (error) {
      return {
        condition: condition.condition,
        severity: condition.severity,
        message: 'Fix is ineffective - reproducer test still fails',
        remediation: condition.remediation,
        checkCommand: condition.check_command,
        output: error.stdout || error.message
      };
    }
  }

  /**
   * Check for security vulnerabilities
   */
  private checkSecurityVulnerabilities(condition: FailureCondition, activity: Activity): FailureReason | null {
    if (activity.metrics.securityVulnerabilities > 0) {
      return {
        condition: condition.condition,
        severity: condition.severity,
        message: `${activity.metrics.securityVulnerabilities} security vulnerabilities found`,
        remediation: condition.remediation,
        checkCommand: condition.check_command
      };
    }
    return null;
  }

  /**
   * Check for unversioned breaking changes
   */
  private checkBreakingChanges(condition: FailureCondition, activity: Activity): FailureReason | null {
    if (activity.metrics.apiBreakingChanges > 0) {
      return {
        condition: condition.condition,
        severity: condition.severity,
        message: `${activity.metrics.apiBreakingChanges} breaking API changes without version bump`,
        remediation: condition.remediation,
        checkCommand: condition.check_command
      };
    }
    return null;
  }

  /**
   * Check for memory regression
   */
  private checkMemoryRegression(condition: FailureCondition, activity: Activity): FailureReason | null {
    if (activity.metrics.memoryUsageChange > 0.10) { // 10% increase threshold
      return {
        condition: condition.condition,
        severity: condition.severity,
        message: `Memory usage increased by ${(activity.metrics.memoryUsageChange * 100).toFixed(1)}%`,
        remediation: condition.remediation,
        checkCommand: condition.check_command
      };
    }
    return null;
  }

  /**
   * Check for build failures
   */
  private checkBuildFailures(condition: FailureCondition, activity: Activity): FailureReason | null {
    if (activity.metrics.buildErrors > 0) {
      return {
        condition: condition.condition,
        severity: condition.severity,
        message: `${activity.metrics.buildErrors} build errors`,
        remediation: condition.remediation,
        checkCommand: condition.check_command
      };
    }
    return null;
  }

  /**
   * Check for linting failures
   */
  private checkLintingFailures(condition: FailureCondition, activity: Activity): FailureReason | null {
    if (activity.metrics.lintingErrors > 0) {
      return {
        condition: condition.condition,
        severity: condition.severity,
        message: `${activity.metrics.lintingErrors} linting errors`,
        remediation: condition.remediation,
        checkCommand: condition.check_command
      };
    }
    return null;
  }

  /**
   * Check soft failure conditions
   */
  private async checkSoftFailures(activity: Activity): Promise<FailureReason[]> {
    const failures: FailureReason[] = [];
    
    for (const condition of this.config.soft_failures) {
      const failure = await this.checkCondition(condition, activity);
      if (failure) {
        failures.push(failure);
      }
    }
    
    return failures;
  }

  /**
   * Handle activity failures
   */
  handleActivityFailures(activity: Activity, failures: FailureReason[]): void {
    if (failures.length === 0) {
      console.log(`✅ Activity ${activity.id} passed all failure condition checks`);
      return;
    }

    console.error(`\n❌ ACTIVITY FAILED: ${activity.id}`);
    console.error(`Activity type: ${activity.type}`);
    console.error(`Failure conditions detected:\n`);

    const criticalFailures = failures.filter(f => f.severity === 'CRITICAL');
    const highFailures = failures.filter(f => f.severity === 'HIGH');
    const mediumFailures = failures.filter(f => f.severity === 'MEDIUM');
    const lowFailures = failures.filter(f => f.severity === 'LOW');

    // Report critical failures first
    if (criticalFailures.length > 0) {
      console.error('🚨 CRITICAL FAILURES:');
      criticalFailures.forEach(f => {
        console.error(`  - ${f.condition}: ${f.message}`);
        console.error(`    Remediation: ${f.remediation}`);
        if (f.output) {
          console.error(`    Output: ${f.output.substring(0, 200)}...`);
        }
        console.error('');
      });
    }

    // Report other failures
    [...highFailures, ...mediumFailures, ...lowFailures].forEach(f => {
      const icon = f.severity === 'HIGH' ? '🔴' : f.severity === 'MEDIUM' ? '🟡' : '🟠';
      console.error(`${icon} ${f.severity}: ${f.condition} - ${f.message}`);
      console.error(`    Remediation: ${f.remediation}`);
      console.error('');
    });

    // Generate failure report
    this.generateFailureReport(activity, failures);

    // Exit with failure code if critical failures exist
    if (criticalFailures.length > 0) {
      console.error('🛑 Activity cannot continue due to critical failures');
      process.exit(1);
    } else if (highFailures.length > 0) {
      console.error('⚠️  Activity has high-severity failures - manual review required');
      process.exit(2);
    } else {
      console.warn('ℹ️  Activity has warnings but can continue');
    }
  }

  /**
   * Generate failure report
   */
  private generateFailureReport(activity: Activity, failures: FailureReason[]): void {
    if (!this.config.reporting?.generate_failure_report) {
      return;
    }

    const report = {
      activity_id: activity.id,
      activity_type: activity.type,
      timestamp: new Date().toISOString(),
      failure_count: failures.length,
      critical_failures: failures.filter(f => f.severity === 'CRITICAL').length,
      high_failures: failures.filter(f => f.severity === 'HIGH').length,
      failures: failures.map(f => ({
        condition: f.condition,
        severity: f.severity,
        message: f.message,
        remediation: f.remediation,
        check_command: f.checkCommand,
        output: f.output?.substring(0, 1000) // Truncate output
      }))
    };

    const reportPath = join(this.projectRoot, 'reports', `activity-failure-${activity.id}.json`);
    
    try {
      const fs = require('fs');
      fs.mkdirSync(join(this.projectRoot, 'reports'), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📊 Failure report saved: ${reportPath}`);
    } catch (error) {
      console.error(`Failed to save failure report: ${error.message}`);
    }
  }
}

/**
 * Standalone function for checking activity failure conditions
 */
export async function checkActivityFailureConditions(
  activity: Activity, 
  configPath?: string
): Promise<FailureReason[]> {
  const detector = new ActivityFailureDetector(configPath);
  return detector.checkActivityFailureConditions(activity);
}

/**
 * Integration function for activity runner
 */
export async function validateActivityBeforeCommit(
  activity: Activity,
  configPath?: string
): Promise<boolean> {
  console.log(`\n🔍 Validating activity ${activity.id} before commit...`);
  
  try {
    const detector = new ActivityFailureDetector(configPath);
    const failures = await detector.checkActivityFailureConditions(activity);
    
    detector.handleActivityFailures(activity, failures);
    
    // Return true only if no critical or high failures
    return !failures.some(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');
  } catch (error) {
    console.error(`❌ Error during activity validation: ${error.message}`);
    return false;
  }
}