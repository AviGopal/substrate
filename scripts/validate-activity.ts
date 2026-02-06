#!/usr/bin/env node

/**
 * Activity Validation Script
 * 
 * Validates activities against failure conditions before commit.
 * Used by activity runners, CI pipelines, and pre-commit hooks.
 */

import { ActivityFailureDetector, validateActivityBeforeCommit } from '../lib/activity-failure-detector';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface ActivityValidationArgs {
  activityId?: string;
  activityType?: 'fix' | 'feature' | 'bugfix' | 'refactor' | 'security';
  configPath?: string;
  projectRoot?: string;
  outputFormat?: 'json' | 'text';
  exitOnFailure?: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): ActivityValidationArgs {
  const args = process.argv.slice(2);
  const parsed: ActivityValidationArgs = {
    exitOnFailure: true,
    outputFormat: 'text'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--activity-id':
        parsed.activityId = args[++i];
        break;
      case '--activity-type':
        parsed.activityType = args[++i] as any;
        break;
      case '--config':
        parsed.configPath = args[++i];
        break;
      case '--project-root':
        parsed.projectRoot = args[++i];
        break;
      case '--format':
        parsed.outputFormat = args[++i] as any;
        break;
      case '--no-exit':
        parsed.exitOnFailure = false;
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown argument: ${arg}`);
          process.exit(1);
        }
    }
  }

  return parsed;
}

/**
 * Print help information
 */
function printHelp(): void {
  console.log(`
Activity Validation Script

USAGE:
  npm run validate:activity [OPTIONS]

OPTIONS:
  --activity-id ID       Activity ID to validate
  --activity-type TYPE   Activity type (fix|feature|bugfix|refactor|security)
  --config PATH          Path to failure conditions config file
  --project-root PATH    Project root directory
  --format FORMAT        Output format (json|text) [default: text]
  --no-exit              Don't exit on failure (for CI integration)
  --help                 Show this help

EXAMPLES:
  # Validate current activity
  npm run validate:activity

  # Validate specific activity
  npm run validate:activity --activity-id act_123 --activity-type fix

  # Use custom config
  npm run validate:activity --config ./custom-failure-conditions.json

  # JSON output for CI
  npm run validate:activity --format json --no-exit

ENVIRONMENT:
  ACTIVITY_ID           Activity ID (if not provided via --activity-id)
  ACTIVITY_TYPE         Activity type (if not provided via --activity-type)
  CONFIG_PATH           Config file path (if not provided via --config)
`);
}

/**
 * Detect activity type from git commit message
 */
function detectActivityTypeFromGit(): string | null {
  try {
    const commitMessage = execSync('git log -1 --pretty=%B', { encoding: 'utf-8' }).trim();
    
    if (commitMessage.startsWith('fix:') || commitMessage.includes('bug fix')) {
      return 'fix';
    } else if (commitMessage.startsWith('feat:') || commitMessage.includes('feature')) {
      return 'feature';
    } else if (commitMessage.startsWith('refactor:')) {
      return 'refactor';
    } else if (commitMessage.includes('security')) {
      return 'security';
    } else if (commitMessage.includes('fix') || commitMessage.includes('bug')) {
      return 'bugfix';
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Collect activity metrics
 */
async function collectActivityMetrics(projectRoot: string): Promise<any> {
  const metrics = {
    testCoverage: 0,
    newCriticalIssues: 0,
    testFailures: 0,
    deadCodeLines: 0,
    memoryUsageChange: 0,
    buildErrors: 0,
    lintingErrors: 0,
    securityVulnerabilities: 0,
    apiBreakingChanges: 0
  };

  try {
    // Collect test coverage
    try {
      const coverageOutput = execSync('npm test -- --coverage --silent', { 
        cwd: projectRoot, 
        encoding: 'utf-8',
        timeout: 60000
      });
      
      const coverageMatch = coverageOutput.match(/All files\s+\|\s+([\d.]+)/);
      if (coverageMatch) {
        metrics.testCoverage = parseFloat(coverageMatch[1]) / 100;
      }
    } catch (error) {
      console.warn('Could not collect test coverage:', error.message);
    }

    // Collect critical issues
    try {
      const issuesOutput = execSync('metabob-cli get-priority-issues --severity CRITICAL,HIGH --count', { 
        cwd: projectRoot, 
        encoding: 'utf-8',
        timeout: 30000
      });
      
      const issuesMatch = issuesOutput.match(/(\d+) issues found/);
      if (issuesMatch) {
        metrics.newCriticalIssues = parseInt(issuesMatch[1]);
      }
    } catch (error) {
      console.warn('Could not collect critical issues:', error.message);
    }

    // Collect test failures
    try {
      execSync('npm test --silent', { 
        cwd: projectRoot, 
        encoding: 'utf-8',
        timeout: 60000
      });
      metrics.testFailures = 0;
    } catch (error) {
      // Count failed tests from output
      const failureMatch = error.stdout?.match(/(\d+) failed/);
      metrics.testFailures = failureMatch ? parseInt(failureMatch[1]) : 1;
    }

    // Collect dead code
    try {
      const deadCodeOutput = execSync('metabob-cli search-issues --pattern "dead.*code|unused.*function" --count', { 
        cwd: projectRoot, 
        encoding: 'utf-8',
        timeout: 30000
      });
      
      const deadCodeMatch = deadCodeOutput.match(/(\d+) lines/);
      if (deadCodeMatch) {
        metrics.deadCodeLines = parseInt(deadCodeMatch[1]);
      }
    } catch (error) {
      console.warn('Could not collect dead code metrics:', error.message);
    }

    // Collect build errors
    try {
      execSync('npm run build', { 
        cwd: projectRoot, 
        encoding: 'utf-8',
        timeout: 120000
      });
      metrics.buildErrors = 0;
    } catch (error) {
      metrics.buildErrors = 1;
    }

    // Collect linting errors
    try {
      execSync('npm run lint', { 
        cwd: projectRoot, 
        encoding: 'utf-8',
        timeout: 60000
      });
      metrics.lintingErrors = 0;
    } catch (error) {
      const errorMatch = error.stdout?.match(/(\d+) error/);
      metrics.lintingErrors = errorMatch ? parseInt(errorMatch[1]) : 1;
    }

    // Collect security vulnerabilities
    try {
      execSync('npm audit --audit-level=high', { 
        cwd: projectRoot, 
        encoding: 'utf-8',
        timeout: 60000
      });
      metrics.securityVulnerabilities = 0;
    } catch (error) {
      const vulnMatch = error.stdout?.match(/(\d+) vulnerabilities/);
      metrics.securityVulnerabilities = vulnMatch ? parseInt(vulnMatch[1]) : 1;
    }

  } catch (error) {
    console.warn('Error collecting metrics:', error.message);
  }

  return metrics;
}

/**
 * Create activity object from current state
 */
async function createActivityFromCurrentState(
  activityId: string, 
  activityType: string, 
  projectRoot: string
): Promise<any> {
  // Get git diff output to approximate activity output
  let output = '';
  try {
    output = execSync('git diff HEAD~1..HEAD', { cwd: projectRoot, encoding: 'utf-8' });
  } catch (error) {
    output = 'No git changes detected';
  }

  // Get modified files
  let files: string[] = [];
  try {
    const filesOutput = execSync('git diff --name-only HEAD~1..HEAD', { cwd: projectRoot, encoding: 'utf-8' });
    files = filesOutput.trim().split('\n').filter(f => f);
  } catch (error) {
    files = [];
  }

  const metrics = await collectActivityMetrics(projectRoot);

  return {
    id: activityId,
    type: activityType,
    output,
    metrics,
    files,
    status: 'completed'
  };
}

/**
 * Main validation function
 */
async function main(): Promise<void> {
  const args = parseArgs();
  const projectRoot = args.projectRoot || process.cwd();

  // Determine activity ID and type
  const activityId = args.activityId || process.env.ACTIVITY_ID || `activity_${Date.now()}`;
  const activityType = args.activityType || process.env.ACTIVITY_TYPE || detectActivityTypeFromGit() || 'fix';

  console.log(`🔍 Validating activity: ${activityId} (${activityType})`);

  try {
    // Create activity object
    const activity = await createActivityFromCurrentState(activityId, activityType, projectRoot);

    // Validate activity
    const detector = new ActivityFailureDetector(args.configPath, projectRoot);
    const failures = await detector.checkActivityFailureConditions(activity);

    // Output results
    if (args.outputFormat === 'json') {
      const result = {
        activity_id: activityId,
        activity_type: activityType,
        success: failures.length === 0,
        failure_count: failures.length,
        critical_failures: failures.filter(f => f.severity === 'CRITICAL').length,
        high_failures: failures.filter(f => f.severity === 'HIGH').length,
        failures: failures.map(f => ({
          condition: f.condition,
          severity: f.severity,
          message: f.message,
          remediation: f.remediation
        }))
      };
      
      console.log(JSON.stringify(result, null, 2));
    } else {
      // Text output
      if (failures.length === 0) {
        console.log('✅ Activity passed all validation checks');
      } else {
        console.log(`❌ Activity failed ${failures.length} validation checks`);
        detector.handleActivityFailures(activity, failures);
      }
    }

    // Exit with appropriate code
    if (args.exitOnFailure) {
      const criticalFailures = failures.filter(f => f.severity === 'CRITICAL');
      const highFailures = failures.filter(f => f.severity === 'HIGH');
      
      if (criticalFailures.length > 0) {
        process.exit(1);
      } else if (highFailures.length > 0) {
        process.exit(2);
      } else if (failures.length > 0) {
        process.exit(3);
      }
    }

  } catch (error) {
    console.error(`❌ Validation failed with error: ${error.message}`);
    
    if (args.outputFormat === 'json') {
      console.log(JSON.stringify({
        activity_id: activityId,
        activity_type: activityType,
        success: false,
        error: error.message
      }, null, 2));
    }
    
    if (args.exitOnFailure) {
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main as validateActivity };