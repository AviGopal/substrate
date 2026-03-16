/**
 * Prerequisite validation utilities for minibob validation harnesses
 * 
 * Purpose: Validate setup without deployment (dry-run mode)
 * Used by: All 4 validation harnesses + CLI runner
 */

import { execSync } from 'child_process';
import { existsSync, accessSync, constants } from 'fs';
import { resolve } from 'path';

export interface PrerequisiteCheck {
  name: string;
  check: () => Promise<boolean>;
  fix: string; // Actionable fix suggestion
  required: boolean;
  category: 'dependency' | 'infrastructure' | 'filesystem' | 'network';
}

export interface PrerequisiteResult {
  check: string;
  pass: boolean;
  fix?: string;
  error?: string;
  category: string;
}

export interface ValidationReport {
  pass: boolean;
  totalChecks: number;
  passed: number;
  failed: number;
  results: PrerequisiteResult[];
  readyForValidation: boolean;
}

/**
 * Check if a command exists in PATH
 */
export async function checkCommandExists(command: string): Promise<boolean> {
  try {
    execSync(`command -v ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get version of a command
 */
export async function getCommandVersion(command: string, versionFlag = '--version'): Promise<string | null> {
  try {
    const output = execSync(`${command} ${versionFlag}`, { encoding: 'utf-8', stdio: 'pipe' });
    return output.trim().split('\n')[0];
  } catch {
    return null;
  }
}

/**
 * Check if kubectl can access the cluster
 */
export async function checkClusterAccessible(): Promise<boolean> {
  try {
    execSync('kubectl cluster-info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a namespace exists
 */
export async function checkNamespaceExists(namespace: string): Promise<boolean> {
  try {
    execSync(`kubectl get namespace ${namespace}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if pods exist in a namespace (not necessarily running)
 */
export async function checkPodsExist(namespace: string, selector?: string): Promise<boolean> {
  try {
    const selectorArg = selector ? `-l ${selector}` : '';
    const output = execSync(`kubectl get pods -n ${namespace} ${selectorArg} -o json`, { encoding: 'utf-8' });
    const pods = JSON.parse(output);
    return pods.items && pods.items.length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if a deployment exists
 */
export async function checkDeploymentExists(namespace: string, deploymentName: string): Promise<boolean> {
  try {
    execSync(`kubectl get deployment ${deploymentName} -n ${namespace}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a file or directory exists
 */
export async function checkPathExists(path: string): Promise<boolean> {
  try {
    return existsSync(resolve(path));
  } catch {
    return false;
  }
}

/**
 * Check if a script is executable
 */
export async function checkScriptExecutable(scriptPath: string): Promise<boolean> {
  try {
    accessSync(resolve(scriptPath), constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if docker is running
 */
export async function checkDockerRunning(): Promise<boolean> {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate all prerequisites and return a report
 */
export async function validatePrerequisites(checks: PrerequisiteCheck[]): Promise<ValidationReport> {
  const results: PrerequisiteResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    try {
      const result = await check.check();
      if (result) {
        passed++;
        results.push({
          check: check.name,
          pass: true,
          category: check.category
        });
      } else {
        failed++;
        results.push({
          check: check.name,
          pass: false,
          fix: check.fix,
          category: check.category
        });
      }
    } catch (error) {
      failed++;
      results.push({
        check: check.name,
        pass: false,
        fix: check.fix,
        error: String(error),
        category: check.category
      });
    }
  }

  const requiredChecks = checks.filter(c => c.required);
  const requiredPassed = results.filter((r, i) => r.pass && checks[i].required).length;
  const readyForValidation = requiredPassed === requiredChecks.length;

  return {
    pass: failed === 0,
    totalChecks: checks.length,
    passed,
    failed,
    results,
    readyForValidation
  };
}

/**
 * Print prerequisite report in human-readable format
 */
export function printPrerequisiteReport(report: ValidationReport): void {
  console.log('\n=== Pre-flight Checks ===\n');

  // Group by category
  const categories = ['dependency', 'infrastructure', 'filesystem', 'network'];
  for (const category of categories) {
    const categoryResults = report.results.filter(r => r.category === category);
    if (categoryResults.length === 0) continue;

    console.log(`${category.toUpperCase()}:`);
    for (const result of categoryResults) {
      const icon = result.pass ? '✓' : '✗';
      const status = result.pass ? 'PASS' : 'FAIL';
      console.log(`  ${icon} ${result.check}: ${status}`);
      if (!result.pass && result.fix) {
        console.log(`    Fix: ${result.fix}`);
      }
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }
    }
    console.log('');
  }

  console.log(`Pre-flight: ${report.passed}/${report.totalChecks} checks passed`);
  console.log(`Ready to run validation: ${report.readyForValidation ? 'YES' : 'NO'}\n`);
}

/**
 * Common prerequisite checks for minibob validation
 */
export const COMMON_CHECKS = {
  kubectl: (): PrerequisiteCheck => ({
    name: 'kubectl installed',
    check: async () => {
      const exists = await checkCommandExists('kubectl');
      if (exists) {
        const version = await getCommandVersion('kubectl', 'version --client --short');
        console.log(`    Version: ${version}`);
      }
      return exists;
    },
    fix: 'Install kubectl: https://kubernetes.io/docs/tasks/tools/',
    required: true,
    category: 'dependency'
  }),

  helmfile: (): PrerequisiteCheck => ({
    name: 'helmfile installed',
    check: async () => {
      const exists = await checkCommandExists('helmfile');
      if (exists) {
        const version = await getCommandVersion('helmfile');
        console.log(`    Version: ${version}`);
      }
      return exists;
    },
    fix: 'Install helmfile: https://helmfile.readthedocs.io/en/latest/#installation',
    required: true,
    category: 'dependency'
  }),

  bun: (): PrerequisiteCheck => ({
    name: 'bun installed',
    check: async () => {
      const exists = await checkCommandExists('bun');
      if (exists) {
        const version = await getCommandVersion('bun');
        console.log(`    Version: ${version}`);
      }
      return exists;
    },
    fix: 'Install bun: https://bun.sh/docs/installation',
    required: true,
    category: 'dependency'
  }),

  docker: (): PrerequisiteCheck => ({
    name: 'docker running',
    check: async () => {
      const running = await checkDockerRunning();
      if (running) {
        const version = await getCommandVersion('docker');
        console.log(`    Version: ${version}`);
      }
      return running;
    },
    fix: 'Install and start docker: https://docs.docker.com/get-docker/',
    required: true,
    category: 'dependency'
  }),

  cluster: (): PrerequisiteCheck => ({
    name: 'kubernetes cluster accessible',
    check: checkClusterAccessible,
    fix: 'Start kind cluster: kind create cluster --name minibob-test',
    required: true,
    category: 'infrastructure'
  }),

  namespace: (namespace: string): PrerequisiteCheck => ({
    name: `namespace '${namespace}' exists`,
    check: () => checkNamespaceExists(namespace),
    fix: `Create namespace: kubectl create namespace ${namespace}`,
    required: true,
    category: 'infrastructure'
  }),

  pods: (namespace: string, selector?: string): PrerequisiteCheck => ({
    name: `pods exist in namespace '${namespace}'`,
    check: () => checkPodsExist(namespace, selector),
    fix: `Deploy minibob: cd helm && helmfile -e testing sync -l namespace=${namespace}`,
    required: false,
    category: 'infrastructure'
  }),

  deployment: (namespace: string, name: string): PrerequisiteCheck => ({
    name: `deployment '${name}' exists`,
    check: () => checkDeploymentExists(namespace, name),
    fix: `Deploy ${name}: cd helm && helmfile -e testing sync -l app=${name}`,
    required: false,
    category: 'infrastructure'
  }),

  path: (path: string, description: string): PrerequisiteCheck => ({
    name: `${description} exists`,
    check: () => checkPathExists(path),
    fix: `Ensure path exists: ${path}`,
    required: true,
    category: 'filesystem'
  }),

  script: (scriptPath: string): PrerequisiteCheck => ({
    name: `script '${scriptPath}' is executable`,
    check: () => checkScriptExecutable(scriptPath),
    fix: `Make executable: chmod +x ${scriptPath}`,
    required: false,
    category: 'filesystem'
  })
};
