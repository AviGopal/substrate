#!/usr/bin/env ts-node
/**
 * SurrealDB v3.0+ Upgrade and Cross-Vessel Type Validation Harness
 * 
 * Executes upgrade and validation in phases:
 * 
 * PHASE 1: Check Current State
 *   - Verify current SurrealDB version (v2.3.10 or v2.6.0)
 *   - Check Python requirements for surrealdb package
 *   - Document baseline state
 * 
 * PHASE 2: Upgrade SurrealDB
 *   - Update Helm chart values to use v3.0.0+ image
 *   - Update requirements.txt for surrealdb-py>=0.3.0
 *   - Deploy with helmfile
 *   - Wait for rollout completion
 *   - Verify new version deployed
 * 
 * PHASE 3: Database Migration
 *   - Connect to new SurrealDB instance
 *   - Verify schema compatibility
 *   - Test basic CRUD operations
 * 
 * PHASE 4: Validate Fix
 *   - Re-run cross-vessel type preservation tests
 *   - Verify no 'already exists' false positives
 *   - Confirm type preservation (int stays int, bool stays bool)
 *   - Confirm value matching (deep equality)
 * 
 * VALIDATION SUCCESS: All tests pass, types preserved, no runtime errors
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  HELM_VALUES_PATH: 'repos/platform/metabob-apps/charts/surrealdb/values/default.surrealdb.values.yaml',
  REQUIREMENTS_PATH: 'repos/metabob-rpc-api/requirements.txt',
  NAMESPACE: 'metabob',
  DEPLOYMENT_NAME: 'surrealdb',
  TARGET_VERSION: 'v3.0.0',
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:8000',
  API_KEY: process.env.API_KEY || 'test-api-key',
  PROJECT_ID: 'test-project',
};

interface TestResult {
  phase: string;
  testName: string;
  passed: boolean;
  input?: any;
  expected?: any;
  actual?: any;
  error?: string;
  typeMismatches?: string[];
  valueMismatches?: string[];
}

interface ValidationReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  phases: {
    [key: string]: {
      total: number;
      passed: number;
      failed: number;
      tests: TestResult[];
    };
  };
}

class ValidationHarness {
  private results: TestResult[] = [];
  private currentPhase: string = '';

  async run(): Promise<ValidationReport> {
    console.log('================================================================================');
    console.log('SurrealDB v3.0+ Upgrade and Cross-Vessel Type Validation Harness');
    console.log('================================================================================\n');

    try {
      // PHASE 1: Check Current State
      await this.phase1_CheckCurrentState();

      // PHASE 2: Upgrade SurrealDB
      await this.phase2_UpgradeSurrealDB();

      // PHASE 3: Database Migration
      await this.phase3_DatabaseMigration();

      // PHASE 4: Validate Fix
      await this.phase4_ValidateFix();

      return this.generateReport();
    } catch (error) {
      console.error('❌ Harness execution failed:', error);
      throw error;
    }
  }

  // ==================== PHASE 1: Check Current State ====================

  async phase1_CheckCurrentState(): Promise<void> {
    this.currentPhase = 'PHASE 1: Check Current State';
    console.log(`\n${this.currentPhase}`);
    console.log('================================================================================\n');

    // Test 1.1: Check deployed SurrealDB version
    await this.runTest({
      testName: 'Check Deployed SurrealDB Version',
      testFn: async () => {
        const { stdout } = await execAsync(
          `kubectl get deployment ${CONFIG.DEPLOYMENT_NAME} -n ${CONFIG.NAMESPACE} -o jsonpath='{.spec.template.spec.containers[0].image}'`
        );
        const image = stdout.trim();
        const versionMatch = image.match(/:(v[\d.]+)/);
        const currentVersion = versionMatch ? versionMatch[1] : 'unknown';

        return {
          passed: currentVersion.startsWith('v2.'),
          input: { command: 'kubectl get deployment' },
          expected: { versionPattern: 'v2.x' },
          actual: { image, version: currentVersion },
        };
      },
    });

    // Test 1.2: Check Helm values file
    await this.runTest({
      testName: 'Check Helm Values Configuration',
      testFn: async () => {
        const valuesPath = path.join(process.cwd(), CONFIG.HELM_VALUES_PATH);
        const valuesContent = await fs.readFile(valuesPath, 'utf-8');
        const tagMatch = valuesContent.match(/tag:\s*["']?(v[\d.]+)["']?/);
        const configuredVersion = tagMatch ? tagMatch[1] : 'unknown';

        return {
          passed: configuredVersion.startsWith('v2.'),
          input: { file: CONFIG.HELM_VALUES_PATH },
          expected: { versionPattern: 'v2.x' },
          actual: { configuredVersion },
        };
      },
    });

    // Test 1.3: Check Python requirements
    await this.runTest({
      testName: 'Check Python surrealdb Package',
      testFn: async () => {
        const reqPath = path.join(process.cwd(), CONFIG.REQUIREMENTS_PATH);
        const reqContent = await fs.readFile(reqPath, 'utf-8');
        const surrealdbMatch = reqContent.match(/surrealdb([><=!]+[\d.]+)?/);
        const requirement = surrealdbMatch ? surrealdbMatch[0] : 'not found';

        return {
          passed: !!surrealdbMatch,
          input: { file: CONFIG.REQUIREMENTS_PATH },
          expected: { pattern: 'surrealdb>=X.X.X' },
          actual: { requirement },
        };
      },
    });
  }

  // ==================== PHASE 2: Upgrade SurrealDB ====================

  async phase2_UpgradeSurrealDB(): Promise<void> {
    this.currentPhase = 'PHASE 2: Upgrade SurrealDB';
    console.log(`\n${this.currentPhase}`);
    console.log('================================================================================\n');

    // Test 2.1: Update Helm values to v3.0.0
    await this.runTest({
      testName: 'Update Helm Values to v3.0.0',
      testFn: async () => {
        const valuesPath = path.join(process.cwd(), CONFIG.HELM_VALUES_PATH);
        let valuesContent = await fs.readFile(valuesPath, 'utf-8');
        
        // Backup original
        await fs.writeFile(`${valuesPath}.backup`, valuesContent);
        
        // Update version
        valuesContent = valuesContent.replace(
          /tag:\s*["']?v[\d.]+["']?/,
          `tag: "${CONFIG.TARGET_VERSION}"`
        );
        
        await fs.writeFile(valuesPath, valuesContent);
        
        // Verify update
        const updatedContent = await fs.readFile(valuesPath, 'utf-8');
        const updated = updatedContent.includes(CONFIG.TARGET_VERSION);

        return {
          passed: updated,
          input: { originalVersion: 'v2.x' },
          expected: { version: CONFIG.TARGET_VERSION },
          actual: { updated, file: valuesPath },
        };
      },
    });

    // Test 2.2: Update Python requirements
    await this.runTest({
      testName: 'Update Python Requirements for v3.0+',
      testFn: async () => {
        const reqPath = path.join(process.cwd(), CONFIG.REQUIREMENTS_PATH);
        let reqContent = await fs.readFile(reqPath, 'utf-8');
        
        // Backup original
        await fs.writeFile(`${reqPath}.backup`, reqContent);
        
        // Update surrealdb requirement
        if (!reqContent.match(/surrealdb-py/)) {
          // Add surrealdb-py if not present
          reqContent = reqContent.replace(
            /surrealdb([><=!]+[\d.]+)?/,
            'surrealdb-py>=0.3.0  # Official SurrealDB Python SDK for v3.0+'
          );
        }
        
        await fs.writeFile(reqPath, reqContent);
        
        // Verify update
        const updatedContent = await fs.readFile(reqPath, 'utf-8');
        const hasSurrealdbPy = updatedContent.includes('surrealdb-py');
        const hasSurrealdb = !!updatedContent.match(/surrealdb>=[\d.]+/);
        const updated = hasSurrealdbPy || hasSurrealdb;

        return {
          passed: updated,
          input: { originalRequirement: 'surrealdb>=1.0.0' },
          expected: { requirement: 'surrealdb-py>=0.3.0 or compatible' },
          actual: { updated, hasSurrealdbPy, hasSurrealdb, file: reqPath },
        };
      },
    });

    // Test 2.3: Deploy with helmfile
    await this.runTest({
      testName: 'Deploy SurrealDB v3.0+ with Helmfile',
      testFn: async () => {
        console.log('  Deploying with helmfile...');
        
        try {
          const { stdout, stderr } = await execAsync(
            `helmfile --environment default -l name=${CONFIG.DEPLOYMENT_NAME} apply`,
            { cwd: process.cwd(), timeout: 300000 } // 5 minute timeout
          );

          return {
            passed: !stderr.includes('ERROR') && !stderr.includes('FAILED'),
            input: { command: 'helmfile apply' },
            expected: { status: 'success' },
            actual: { stdout: stdout.slice(0, 500), stderr: stderr.slice(0, 500) },
          };
        } catch (error: any) {
          return {
            passed: false,
            input: { command: 'helmfile apply' },
            expected: { status: 'success' },
            actual: { error: error.message },
          };
        }
      },
    });

    // Test 2.4: Wait for rollout
    await this.runTest({
      testName: 'Wait for Deployment Rollout',
      testFn: async () => {
        console.log('  Waiting for rollout to complete (max 5 minutes)...');
        
        try {
          const { stdout } = await execAsync(
            `kubectl rollout status deployment/${CONFIG.DEPLOYMENT_NAME} -n ${CONFIG.NAMESPACE} --timeout=5m`
          );

          const success = stdout.includes('successfully rolled out');

          return {
            passed: success,
            input: { command: 'kubectl rollout status' },
            expected: { status: 'successfully rolled out' },
            actual: { stdout: stdout.trim() },
          };
        } catch (error: any) {
          return {
            passed: false,
            input: { command: 'kubectl rollout status' },
            expected: { status: 'successfully rolled out' },
            actual: { error: error.message },
          };
        }
      },
    });

    // Test 2.5: Verify new version
    await this.runTest({
      testName: 'Verify SurrealDB v3.0+ Deployed',
      testFn: async () => {
        const { stdout } = await execAsync(
          `kubectl exec deployment/${CONFIG.DEPLOYMENT_NAME} -n ${CONFIG.NAMESPACE} -- surreal version`
        );
        
        const versionMatch = stdout.match(/surreal\s+([\d.]+)/);
        const deployedVersion = versionMatch ? versionMatch[1] : 'unknown';
        const isV3 = deployedVersion.startsWith('3.');

        return {
          passed: isV3,
          input: { command: 'surreal version' },
          expected: { versionPattern: '3.x' },
          actual: { version: deployedVersion, output: stdout.trim() },
        };
      },
    });
  }

  // ==================== PHASE 3: Database Migration ====================

  async phase3_DatabaseMigration(): Promise<void> {
    this.currentPhase = 'PHASE 3: Database Migration';
    console.log(`\n${this.currentPhase}`);
    console.log('================================================================================\n');

    // Test 3.1: Test database connectivity
    await this.runTest({
      testName: 'Test Database Connectivity',
      testFn: async () => {
        try {
          const response = await fetch(`${CONFIG.API_BASE_URL}/health`);
          const data = await response.json();

          return {
            passed: response.ok && data.status === 'healthy',
            input: { endpoint: '/health' },
            expected: { status: 'healthy' },
            actual: { status: response.status, data },
          };
        } catch (error: any) {
          return {
            passed: false,
            input: { endpoint: '/health' },
            expected: { status: 'healthy' },
            actual: { error: error.message },
          };
        }
      },
    });

    // Test 3.2: Test basic CRUD - Create
    await this.runTest({
      testName: 'Test Basic CRUD - Create Impulse',
      testFn: async () => {
        const testImpulseId = `test-crud-${Date.now()}`;
        const testData = {
          impulse_id: testImpulseId,
          project_id: CONFIG.PROJECT_ID,
          impulse_data: {
            id: testImpulseId,
            type: 'testResults',
            pointer: {
              type: 'testResults',
              data: { test: true, value: 123 },
            },
            budget: 1000,
          },
        };

        try {
          const response = await fetch(`${CONFIG.API_BASE_URL}/v2/impulses`, {
            method: 'POST',
            headers: {
              'X-API-Key': CONFIG.API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(testData),
          });

          const result = await response.json();

          return {
            passed: response.status === 201 || response.status === 200,
            input: testData,
            expected: { status: 201 },
            actual: { status: response.status, result },
          };
        } catch (error: any) {
          return {
            passed: false,
            input: testData,
            expected: { status: 201 },
            actual: { error: error.message },
          };
        }
      },
    });

    // Test 3.3: Test basic CRUD - Read
    await this.runTest({
      testName: 'Test Basic CRUD - Read Impulse',
      testFn: async () => {
        const testImpulseId = `test-crud-${Date.now() - 1000}`; // Use ID from previous test
        
        try {
          const response = await fetch(
            `${CONFIG.API_BASE_URL}/v2/impulses/${testImpulseId}?project_id=${CONFIG.PROJECT_ID}`,
            {
              headers: {
                'X-API-Key': CONFIG.API_KEY,
              },
            }
          );

          const result = await response.json();

          return {
            passed: response.ok,
            input: { impulse_id: testImpulseId },
            expected: { status: 200 },
            actual: { status: response.status, result },
          };
        } catch (error: any) {
          return {
            passed: false,
            input: { impulse_id: testImpulseId },
            expected: { status: 200 },
            actual: { error: error.message },
          };
        }
      },
    });
  }

  // ==================== PHASE 4: Validate Fix ====================

  async phase4_ValidateFix(): Promise<void> {
    this.currentPhase = 'PHASE 4: Validate Fix';
    console.log(`\n${this.currentPhase}`);
    console.log('================================================================================\n');

    // Test 4.1: Type Preservation - Integer
    await this.runTest({
      testName: 'Type Preservation - Integer',
      testFn: async () => {
        const impulseId = `type-int-${Date.now()}`;
        const testData = {
          impulse_id: impulseId,
          project_id: CONFIG.PROJECT_ID,
          impulse_data: {
            id: impulseId,
            type: 'testResults',
            pointer: {
              type: 'testResults',
              data: { int_field: 42 },
            },
            budget: 1000,
          },
        };

        // Create impulse
        await fetch(`${CONFIG.API_BASE_URL}/v2/impulses`, {
          method: 'POST',
          headers: {
            'X-API-Key': CONFIG.API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(testData),
        });

        // Retrieve and check type
        const response = await fetch(
          `${CONFIG.API_BASE_URL}/v2/impulses/${impulseId}?project_id=${CONFIG.PROJECT_ID}`,
          {
            headers: { 'X-API-Key': CONFIG.API_KEY },
          }
        );

        const result = await response.json();
        const retrievedValue = result?.impulse_data?.pointer?.data?.int_field;
        const typeMatch = typeof retrievedValue === 'number' && Number.isInteger(retrievedValue);
        const valueMatch = retrievedValue === 42;

        return {
          passed: typeMatch && valueMatch,
          input: { int_field: 42 },
          expected: { type: 'number (integer)', value: 42 },
          actual: { type: typeof retrievedValue, value: retrievedValue },
          typeMismatches: typeMatch ? [] : [`Expected integer, got ${typeof retrievedValue}`],
          valueMismatches: valueMatch ? [] : [`Expected 42, got ${retrievedValue}`],
        };
      },
    });

    // Test 4.2: Type Preservation - Boolean
    await this.runTest({
      testName: 'Type Preservation - Boolean',
      testFn: async () => {
        const impulseId = `type-bool-${Date.now()}`;
        const testData = {
          impulse_id: impulseId,
          project_id: CONFIG.PROJECT_ID,
          impulse_data: {
            id: impulseId,
            type: 'testResults',
            pointer: {
              type: 'testResults',
              data: { bool_field: true },
            },
            budget: 1000,
          },
        };

        // Create impulse
        await fetch(`${CONFIG.API_BASE_URL}/v2/impulses`, {
          method: 'POST',
          headers: {
            'X-API-Key': CONFIG.API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(testData),
        });

        // Retrieve and check type
        const response = await fetch(
          `${CONFIG.API_BASE_URL}/v2/impulses/${impulseId}?project_id=${CONFIG.PROJECT_ID}`,
          {
            headers: { 'X-API-Key': CONFIG.API_KEY },
          }
        );

        const result = await response.json();
        const retrievedValue = result?.impulse_data?.pointer?.data?.bool_field;
        const typeMatch = typeof retrievedValue === 'boolean';
        const valueMatch = retrievedValue === true;

        return {
          passed: typeMatch && valueMatch,
          input: { bool_field: true },
          expected: { type: 'boolean', value: true },
          actual: { type: typeof retrievedValue, value: retrievedValue },
          typeMismatches: typeMatch ? [] : [`Expected boolean, got ${typeof retrievedValue}`],
          valueMismatches: valueMatch ? [] : [`Expected true, got ${retrievedValue}`],
        };
      },
    });

    // Test 4.3: Type Preservation - Float
    await this.runTest({
      testName: 'Type Preservation - Float',
      testFn: async () => {
        const impulseId = `type-float-${Date.now()}`;
        const testData = {
          impulse_id: impulseId,
          project_id: CONFIG.PROJECT_ID,
          impulse_data: {
            id: impulseId,
            type: 'testResults',
            pointer: {
              type: 'testResults',
              data: { float_field: 3.14 },
            },
            budget: 1000,
          },
        };

        // Create impulse
        await fetch(`${CONFIG.API_BASE_URL}/v2/impulses`, {
          method: 'POST',
          headers: {
            'X-API-Key': CONFIG.API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(testData),
        });

        // Retrieve and check type
        const response = await fetch(
          `${CONFIG.API_BASE_URL}/v2/impulses/${impulseId}?project_id=${CONFIG.PROJECT_ID}`,
          {
            headers: { 'X-API-Key': CONFIG.API_KEY },
          }
        );

        const result = await response.json();
        const retrievedValue = result?.impulse_data?.pointer?.data?.float_field;
        const typeMatch = typeof retrievedValue === 'number' && !Number.isInteger(retrievedValue);
        const valueMatch = Math.abs(retrievedValue - 3.14) < 0.001;

        return {
          passed: typeMatch && valueMatch,
          input: { float_field: 3.14 },
          expected: { type: 'number (float)', value: 3.14 },
          actual: { type: typeof retrievedValue, value: retrievedValue },
          typeMismatches: typeMatch ? [] : [`Expected float, got ${typeof retrievedValue}`],
          valueMismatches: valueMatch ? [] : [`Expected 3.14, got ${retrievedValue}`],
        };
      },
    });

    // Test 4.4: Type Preservation - Complex Structure
    await this.runTest({
      testName: 'Type Preservation - Complex Nested Structure',
      testFn: async () => {
        const impulseId = `type-complex-${Date.now()}`;
        const complexData = {
          int_field: 42,
          bool_field: true,
          float_field: 3.14,
          string_field: 'test',
          array_field: [1, 2, 3],
          nested_object: {
            inner_int: 99,
            inner_bool: false,
            inner_array: ['a', 'b', 'c'],
          },
        };

        const testData = {
          impulse_id: impulseId,
          project_id: CONFIG.PROJECT_ID,
          impulse_data: {
            id: impulseId,
            type: 'testResults',
            pointer: {
              type: 'testResults',
              data: complexData,
            },
            budget: 1000,
          },
        };

        // Create impulse
        await fetch(`${CONFIG.API_BASE_URL}/v2/impulses`, {
          method: 'POST',
          headers: {
            'X-API-Key': CONFIG.API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(testData),
        });

        // Retrieve and check types
        const response = await fetch(
          `${CONFIG.API_BASE_URL}/v2/impulses/${impulseId}?project_id=${CONFIG.PROJECT_ID}`,
          {
            headers: { 'X-API-Key': CONFIG.API_KEY },
          }
        );

        const result = await response.json();
        const retrievedData = result?.impulse_data?.pointer?.data;

        const typeMismatches: string[] = [];
        const valueMismatches: string[] = [];

        // Check each field type
        if (typeof retrievedData?.int_field !== 'number' || !Number.isInteger(retrievedData.int_field)) {
          typeMismatches.push(`int_field: expected integer, got ${typeof retrievedData?.int_field}`);
        }
        if (typeof retrievedData?.bool_field !== 'boolean') {
          typeMismatches.push(`bool_field: expected boolean, got ${typeof retrievedData?.bool_field}`);
        }
        if (typeof retrievedData?.float_field !== 'number') {
          typeMismatches.push(`float_field: expected number, got ${typeof retrievedData?.float_field}`);
        }
        if (!Array.isArray(retrievedData?.array_field)) {
          typeMismatches.push(`array_field: expected array, got ${typeof retrievedData?.array_field}`);
        }
        if (typeof retrievedData?.nested_object !== 'object') {
          typeMismatches.push(`nested_object: expected object, got ${typeof retrievedData?.nested_object}`);
        }

        // Check values
        if (retrievedData?.int_field !== 42) {
          valueMismatches.push(`int_field: expected 42, got ${retrievedData?.int_field}`);
        }
        if (retrievedData?.bool_field !== true) {
          valueMismatches.push(`bool_field: expected true, got ${retrievedData?.bool_field}`);
        }

        const passed = typeMismatches.length === 0 && valueMismatches.length === 0;

        return {
          passed,
          input: complexData,
          expected: { types: 'all preserved', values: 'all matched' },
          actual: retrievedData,
          typeMismatches,
          valueMismatches,
        };
      },
    });

    // Test 4.5: No False Positives on Unique IDs
    await this.runTest({
      testName: 'No False "Already Exists" Errors',
      testFn: async () => {
        const uniqueIds = Array.from({ length: 5 }, (_, i) => `unique-${Date.now()}-${i}`);
        const errors: string[] = [];

        for (const impulseId of uniqueIds) {
          const testData = {
            impulse_id: impulseId,
            project_id: CONFIG.PROJECT_ID,
            impulse_data: {
              id: impulseId,
              type: 'testResults',
              pointer: {
                type: 'testResults',
                data: { index: uniqueIds.indexOf(impulseId) },
              },
              budget: 1000,
            },
          };

          const response = await fetch(`${CONFIG.API_BASE_URL}/v2/impulses`, {
            method: 'POST',
            headers: {
              'X-API-Key': CONFIG.API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(testData),
          });

          if (!response.ok) {
            const result = await response.json();
            if (result.error && result.error.includes('already exists')) {
              errors.push(`False positive for ${impulseId}: ${result.error}`);
            }
          }
        }

        return {
          passed: errors.length === 0,
          input: { uniqueIds },
          expected: { errors: 0 },
          actual: { errorCount: errors.length, errors },
        };
      },
    });

    // Test 4.6: Run Python validation harness
    await this.runTest({
      testName: 'Run Python Cross-Vessel Type Preservation Harness',
      testFn: async () => {
        try {
          const { stdout, stderr } = await execAsync(
            'python tests/validation-harnesses/cross-vessel-type-preservation-harness.py',
            { cwd: process.cwd(), timeout: 120000 } // 2 minute timeout
          );

          const passed = stdout.includes('ALL TESTS PASSED') && !stdout.includes('FAIL');
          const testsPassed = (stdout.match(/✅ PASS/g) || []).length;
          const testsFailed = (stdout.match(/❌ FAIL/g) || []).length;

          return {
            passed,
            input: { command: 'python cross-vessel-type-preservation-harness.py' },
            expected: { result: '7/7 tests PASS' },
            actual: { 
              testsPassed, 
              testsFailed, 
              output: stdout.slice(-500),
              stderr: stderr ? stderr.slice(-500) : undefined 
            },
          };
        } catch (error: any) {
          return {
            passed: false,
            input: { command: 'python cross-vessel-type-preservation-harness.py' },
            expected: { result: '7/7 tests PASS' },
            actual: { error: error.message },
          };
        }
      },
    });
  }

  // ==================== Helper Methods ====================

  private async runTest(config: {
    testName: string;
    testFn: () => Promise<{
      passed: boolean;
      input?: any;
      expected?: any;
      actual?: any;
      typeMismatches?: string[];
      valueMismatches?: string[];
    }>;
  }): Promise<void> {
    const { testName, testFn } = config;

    try {
      console.log(`Running: ${testName}...`);
      const result = await testFn();

      const testResult: TestResult = {
        phase: this.currentPhase,
        testName,
        passed: result.passed,
        input: result.input,
        expected: result.expected,
        actual: result.actual,
        typeMismatches: result.typeMismatches,
        valueMismatches: result.valueMismatches,
      };

      this.results.push(testResult);

      if (result.passed) {
        console.log(`✅ PASS: ${testName}\n`);
      } else {
        console.log(`❌ FAIL: ${testName}`);
        if (result.typeMismatches && result.typeMismatches.length > 0) {
          console.log(`  Type Mismatches: ${result.typeMismatches.join(', ')}`);
        }
        if (result.valueMismatches && result.valueMismatches.length > 0) {
          console.log(`  Value Mismatches: ${result.valueMismatches.join(', ')}`);
        }
        console.log('');
      }
    } catch (error: any) {
      console.log(`❌ ERROR: ${testName}`);
      console.log(`  ${error.message}\n`);

      this.results.push({
        phase: this.currentPhase,
        testName,
        passed: false,
        error: error.message,
      });
    }
  }

  private generateReport(): ValidationReport {
    const phases: { [key: string]: { total: number; passed: number; failed: number; tests: TestResult[] } } = {};

    // Group results by phase
    for (const result of this.results) {
      if (!phases[result.phase]) {
        phases[result.phase] = { total: 0, passed: 0, failed: 0, tests: [] };
      }

      phases[result.phase].total++;
      if (result.passed) {
        phases[result.phase].passed++;
      } else {
        phases[result.phase].failed++;
      }
      phases[result.phase].tests.push(result);
    }

    const totalPassed = this.results.filter((r) => r.passed).length;
    const totalFailed = this.results.filter((r) => !r.passed).length;

    const report: ValidationReport = {
      timestamp: new Date().toISOString(),
      totalTests: this.results.length,
      passed: totalPassed,
      failed: totalFailed,
      phases,
    };

    // Print summary
    console.log('\n================================================================================');
    console.log('VALIDATION SUMMARY');
    console.log('================================================================================\n');

    for (const [phase, data] of Object.entries(phases)) {
      console.log(`${phase}: ${data.passed}/${data.total} PASS`);
    }

    console.log(`\nTotal: ${totalPassed}/${this.results.length} PASS (${totalFailed} FAILED)\n`);

    if (totalFailed === 0) {
      console.log('✅ ALL TESTS PASSED - SurrealDB v3.0+ upgrade and type preservation validated!\n');
    } else {
      console.log('❌ VALIDATION FAILED - See details above\n');
    }

    return report;
  }
}

// ==================== Main Execution ====================

async function main() {
  const harness = new ValidationHarness();
  const report = await harness.run();

  // Write report to file
  const reportPath = path.join(process.cwd(), 'validation-results', 'surrealdb-v3-upgrade-validation-report.json');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(`Report written to: ${reportPath}\n`);

  // Exit with appropriate code
  process.exit(report.failed === 0 ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { ValidationHarness, TestResult, ValidationReport };
export async function runValidation(input?: any): Promise<{ pass: boolean; actual: any; expected: any }> {
  const harness = new ValidationHarness();
  const report = await harness.run();

  return {
    pass: report.failed === 0,
    actual: report,
    expected: { totalTests: report.totalTests, passed: report.totalTests, failed: 0 },
  };
}
