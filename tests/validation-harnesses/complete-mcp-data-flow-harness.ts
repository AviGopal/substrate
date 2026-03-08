#!/usr/bin/env tsx
/**
 * Validation Harness: Complete MCP Data Flow for Activity and Impulse System
 * 
 * Tests all MCP tools end-to-end:
 * 1. metabob_post_activity_result - Execution recording to SurrealDB
 * 2. metabob_create_activity_variant - Dynamic variant creation
 * 3. metabob_recommend_activities - ML-driven template recommendations
 * 4. metabob_recommend_impulses - Impulse learning feedback loop
 * 5. metabob_fetch_boredom_activities - Boredom detection system
 * 
 * Validation Strategy:
 * - Tool registration check (MCP server lists tool)
 * - Schema validation (input/output match expectations)
 * - SurrealDB persistence verification (query DB after operations)
 * - Error handling (invalid inputs, missing fields, DB failures)
 * - End-to-end integration (OpenCode → MCP → Backend → DB)
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  MCP_CLI_PATH: path.resolve(__dirname, '../../repos/metabob-cli'),
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:8000',
  SURREALDB_URL: process.env.SURREALDB_URL || 'ws://localhost:8765',
  SURREALDB_NS: 'test',
  SURREALDB_DB: 'test',
  SURREALDB_USER: process.env.SURREALDB_USER || 'root',
  SURREALDB_PASS: process.env.SURREALDB_PASS || 'root',
  TIMEOUT_MS: 30000,
};

// =============================================================================
// Types
// =============================================================================

interface TestCase {
  id: string;
  name: string;
  input: any;
  expectedOutput: any;
  validate: (actual: any) => boolean;
}

interface ValidationResult {
  testCaseId: string;
  passed: boolean;
  actual: any;
  expected: any;
  error?: string;
  timestamp: string;
}

interface HarnessResult {
  specification: string;
  totalTests: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
  summary: string;
}

// =============================================================================
// MCP Client
// =============================================================================

class MCPClient {
  private mcpServerProcess: any;

  async start(): Promise<void> {
    console.log('[MCP] Starting MCP server...');
    
    // Start MCP server as subprocess
    this.mcpServerProcess = spawn('python', ['-m', 'metabob_cli.mcp.server'], {
      cwd: CONFIG.MCP_CLI_PATH,
      env: {
        ...process.env,
        BACKEND_URL: CONFIG.BACKEND_URL,
      },
    });

    // Wait for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log('[MCP] Server started');
  }

  async stop(): Promise<void> {
    if (this.mcpServerProcess) {
      this.mcpServerProcess.kill();
      console.log('[MCP] Server stopped');
    }
  }

  async callTool(toolName: string, args: any): Promise<any> {
    // Call MCP tool via Python subprocess
    const pythonScript = `
import asyncio
import json
import sys
sys.path.insert(0, '${CONFIG.MCP_CLI_PATH}')
from metabob_cli.mcp import activity_template_tools

async def main():
    result = await activity_template_tools.${toolName}(**${JSON.stringify(args)})
    print(json.dumps(result))

asyncio.run(main())
`;

    try {
      const result = execSync(`python -c "${pythonScript.replace(/"/g, '\\"')}"`, {
        cwd: CONFIG.MCP_CLI_PATH,
        env: {
          ...process.env,
          BACKEND_URL: CONFIG.BACKEND_URL,
        },
        timeout: CONFIG.TIMEOUT_MS,
      });

      return JSON.parse(result.toString());
    } catch (error: any) {
      throw new Error(`MCP tool call failed: ${error.message}`);
    }
  }

  async listTools(): Promise<string[]> {
    try {
      const result = execSync('python -m metabob_cli.mcp.server --list-tools', {
        cwd: CONFIG.MCP_CLI_PATH,
        timeout: CONFIG.TIMEOUT_MS,
      });

      return result
        .toString()
        .split('\n')
        .filter((line) => line.startsWith('metabob_'));
    } catch (error: any) {
      throw new Error(`Failed to list MCP tools: ${error.message}`);
    }
  }
}

// =============================================================================
// SurrealDB Client
// =============================================================================

class SurrealDBClient {
  async query(sql: string): Promise<any> {
    // Direct SurrealDB query via HTTP API
    const response = await fetch(`${CONFIG.SURREALDB_URL.replace('ws://', 'http://')}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'NS': CONFIG.SURREALDB_NS,
        'DB': CONFIG.SURREALDB_DB,
        'Authorization': `Basic ${Buffer.from(`${CONFIG.SURREALDB_USER}:${CONFIG.SURREALDB_PASS}`).toString('base64')}`,
      },
      body: sql,
    });

    if (!response.ok) {
      throw new Error(`SurrealDB query failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getActivityExecution(activityId: string): Promise<any> {
    const result = await this.query(`SELECT * FROM activity_executions WHERE activity_id = "${activityId}"`);
    return result[0]?.result?.[0];
  }

  async getActivityTemplate(templateId: string): Promise<any> {
    const result = await this.query(`SELECT * FROM activity_template WHERE variant_id = "${templateId}"`);
    return result[0]?.result?.[0];
  }

  async clearTestData(): Promise<void> {
    await this.query('DELETE FROM activity_executions WHERE activity_id LIKE "test-%"');
    await this.query('DELETE FROM activity_template WHERE variant_id LIKE "test-%"');
  }
}

// =============================================================================
// Test Cases
// =============================================================================

const TEST_CASES: TestCase[] = [
  // Test Case 1: metabob_post_activity_result
  {
    id: 'validation-complete-mcp-data-flow-case-1',
    name: 'Post Activity Result - Success Case',
    input: {
      activity_id: 'test-activity-001',
      result: {
        success: true,
        duration: 45000,
        cost: 0.0234,
        tokens: {
          input: 5000,
          output: 2500,
          cache: 1000,
        },
        impulses_used: [
          {
            impulse_id: 'imp-001',
            impulse_type: 'file',
            usefulness_score: 0.85,
          },
        ],
        component_changes: [
          {
            file_path: 'src/test.ts',
            change_type: 'create',
            lines_added: 50,
          },
        ],
      },
    },
    expectedOutput: {
      status: 'success',
      execution_id: expect.any(String),
    },
    validate: (actual) => {
      return actual.status === 'success' && typeof actual.execution_id === 'string';
    },
  },

  // Test Case 2: metabob_post_activity_result - Error Case
  {
    id: 'validation-complete-mcp-data-flow-case-2',
    name: 'Post Activity Result - Missing Required Fields',
    input: {
      activity_id: 'test-activity-002',
      result: {
        // Missing required fields: success, duration, cost
      },
    },
    expectedOutput: {
      status: 'error',
      error: expect.stringContaining('validation'),
    },
    validate: (actual) => {
      return actual.status === 'error' && actual.error.includes('validation');
    },
  },

  // Test Case 3: metabob_create_activity_variant
  {
    id: 'validation-complete-mcp-data-flow-case-3',
    name: 'Create Activity Variant - Success Case',
    input: {
      base_template_id: 'base-template-001',
      variant_definition: {
        tasks: [
          {
            id: 'task-1',
            description: 'Modified task with recovery strategy',
            prompt: {
              template: 'Do something different: {{variable}}',
            },
          },
        ],
      },
      metadata: {
        name: 'test-variant-001',
        description: 'Test variant for validation',
        reason_for_creation: 'Trailblazing recovery from failure',
      },
    },
    expectedOutput: {
      status: 'success',
      variant_id: expect.any(String),
    },
    validate: (actual) => {
      return actual.status === 'success' && typeof actual.variant_id === 'string';
    },
  },

  // Test Case 4: metabob_recommend_activities
  {
    id: 'validation-complete-mcp-data-flow-case-4',
    name: 'Recommend Activities - With Impulse Context',
    input: {
      task_description: 'Implement user authentication with JWT tokens',
      category: 'feature',
      loaded_impulses: ['imp-auth-001', 'imp-jwt-002'],
      limit: 5,
    },
    expectedOutput: {
      status: 'success',
      recommendations: expect.arrayContaining([
        expect.objectContaining({
          template_id: expect.any(String),
          score: expect.any(Number),
          reason: expect.any(String),
          impulse_alignment: expect.any(Number),
        }),
      ]),
    },
    validate: (actual) => {
      return (
        actual.status === 'success' &&
        Array.isArray(actual.recommendations) &&
        actual.recommendations.every(
          (rec: any) =>
            typeof rec.template_id === 'string' &&
            typeof rec.score === 'number' &&
            rec.score >= 0 &&
            rec.score <= 1
        )
      );
    },
  },

  // Test Case 5: metabob_recommend_impulses
  {
    id: 'validation-complete-mcp-data-flow-case-5',
    name: 'Recommend Impulses - Based on Historical Usage',
    input: {
      activity_id: 'add-authentication',
      task_description: 'Adding JWT authentication to REST API',
      limit: 10,
    },
    expectedOutput: {
      status: 'success',
      recommendations: expect.arrayContaining([
        expect.objectContaining({
          impulse_type: expect.any(String),
          score: expect.any(Number),
          reason: expect.any(String),
          usage_count: expect.any(Number),
        }),
      ]),
    },
    validate: (actual) => {
      return (
        actual.status === 'success' &&
        Array.isArray(actual.recommendations) &&
        actual.recommendations.every(
          (rec: any) =>
            typeof rec.impulse_type === 'string' &&
            typeof rec.score === 'number' &&
            typeof rec.usage_count === 'number'
        )
      );
    },
  },

  // Test Case 6: metabob_fetch_boredom_activities
  {
    id: 'validation-complete-mcp-data-flow-case-6',
    name: 'Fetch Boredom Activities - Low Improvement Gradient',
    input: {
      threshold: 0.5,
      limit: 5,
    },
    expectedOutput: {
      status: 'success',
      activities: expect.any(Array),
      total_count: expect.any(Number),
    },
    validate: (actual) => {
      return (
        actual.status === 'success' &&
        Array.isArray(actual.activities) &&
        typeof actual.total_count === 'number'
      );
    },
  },

  // Test Case 7: SurrealDB Persistence - Activity Execution
  {
    id: 'validation-complete-mcp-data-flow-case-7',
    name: 'Verify SurrealDB Persistence - Activity Execution',
    input: {
      activity_id: 'test-activity-db-001',
      result: {
        success: true,
        duration: 30000,
        cost: 0.015,
        tokens: { input: 3000, output: 1500, cache: 500 },
      },
    },
    expectedOutput: {
      dbRecord: {
        activity_id: 'test-activity-db-001',
        success: true,
        duration_ms: 30000,
      },
    },
    validate: async (actual, db: SurrealDBClient) => {
      const record = await db.getActivityExecution('test-activity-db-001');
      return (
        record &&
        record.activity_id === 'test-activity-db-001' &&
        record.success === true &&
        record.duration_ms === 30000
      );
    },
  },

  // Test Case 8: SurrealDB Persistence - Variant Creation
  {
    id: 'validation-complete-mcp-data-flow-case-8',
    name: 'Verify SurrealDB Persistence - Activity Variant',
    input: {
      base_template_id: 'base-template-db-001',
      variant_definition: { tasks: [] },
      metadata: {
        name: 'test-variant-db-001',
        description: 'DB persistence test',
        reason_for_creation: 'Validation test',
      },
    },
    expectedOutput: {
      dbRecord: {
        variant_id: expect.any(String),
        parent_template_id: 'base-template-db-001',
      },
    },
    validate: async (actual, db: SurrealDBClient) => {
      if (actual.status !== 'success') return false;
      const record = await db.getActivityTemplate(actual.variant_id);
      return (
        record &&
        record.variant_id === actual.variant_id &&
        record.parent_template_id === 'base-template-db-001'
      );
    },
  },
];

// =============================================================================
// Validation Runner
// =============================================================================

export async function runValidation(testCaseId?: string): Promise<HarnessResult> {
  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION HARNESS: Complete MCP Data Flow for Activity and Impulse System');
  console.log('='.repeat(80) + '\n');

  const mcp = new MCPClient();
  const db = new SurrealDBClient();
  const results: ValidationResult[] = [];

  try {
    // Step 1: Verify MCP tools are registered
    console.log('[STEP 1] Verifying MCP tool registration...');
    const tools = await mcp.listTools();
    const requiredTools = [
      'metabob_post_activity_result',
      'metabob_create_activity_variant',
      'metabob_recommend_activities',
      'metabob_recommend_impulses',
      'metabob_fetch_boredom_activities',
    ];

    for (const toolName of requiredTools) {
      if (!tools.includes(toolName)) {
        throw new Error(`Required MCP tool not registered: ${toolName}`);
      }
      console.log(`  ✓ ${toolName}`);
    }

    // Step 2: Start MCP server
    console.log('\n[STEP 2] Starting MCP server...');
    await mcp.start();

    // Step 3: Clear test data
    console.log('\n[STEP 3] Clearing test data from SurrealDB...');
    await db.clearTestData();

    // Step 4: Run test cases
    console.log('\n[STEP 4] Running test cases...\n');

    const testCasesToRun = testCaseId
      ? TEST_CASES.filter((tc) => tc.id === testCaseId)
      : TEST_CASES;

    for (const testCase of testCasesToRun) {
      console.log(`[TEST] ${testCase.name}`);
      console.log(`  ID: ${testCase.id}`);

      try {
        let actual: any;

        // Determine which MCP tool to call based on test case
        if (testCase.id.includes('case-1') || testCase.id.includes('case-2') || testCase.id.includes('case-7')) {
          actual = await mcp.callTool('metabob_post_activity_result', testCase.input);
        } else if (testCase.id.includes('case-3') || testCase.id.includes('case-8')) {
          actual = await mcp.callTool('metabob_create_activity_variant', testCase.input);
        } else if (testCase.id.includes('case-4')) {
          actual = await mcp.callTool('metabob_recommend_activities', testCase.input);
        } else if (testCase.id.includes('case-5')) {
          actual = await mcp.callTool('metabob_recommend_impulses', testCase.input);
        } else if (testCase.id.includes('case-6')) {
          actual = await mcp.callTool('metabob_fetch_boredom_activities', testCase.input);
        }

        // Validate result
        const passed =
          typeof testCase.validate === 'function'
            ? await testCase.validate(actual, db)
            : JSON.stringify(actual) === JSON.stringify(testCase.expectedOutput);

        results.push({
          testCaseId: testCase.id,
          passed,
          actual,
          expected: testCase.expectedOutput,
          timestamp: new Date().toISOString(),
        });

        console.log(`  Result: ${passed ? '✓ PASS' : '✗ FAIL'}`);
        if (!passed) {
          console.log(`  Expected: ${JSON.stringify(testCase.expectedOutput, null, 2)}`);
          console.log(`  Actual:   ${JSON.stringify(actual, null, 2)}`);
        }
      } catch (error: any) {
        results.push({
          testCaseId: testCase.id,
          passed: false,
          actual: null,
          expected: testCase.expectedOutput,
          error: error.message,
          timestamp: new Date().toISOString(),
        });

        console.log(`  Result: ✗ FAIL (Error: ${error.message})`);
      }

      console.log('');
    }

    // Step 5: Generate summary
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    const summary = `
Validation Complete
-------------------
Total Tests:  ${results.length}
Passed:       ${passed} (${((passed / results.length) * 100).toFixed(1)}%)
Failed:       ${failed} (${((failed / results.length) * 100).toFixed(1)}%)

Status: ${failed === 0 ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}
`;

    console.log(summary);

    return {
      specification: 'Complete MCP Data Flow for Activity and Impulse System',
      totalTests: results.length,
      passed,
      failed,
      results,
      summary,
    };
  } finally {
    // Cleanup
    await mcp.stop();
  }
}

// =============================================================================
// CLI Entry Point
// =============================================================================

if (require.main === module) {
  const testCaseId = process.argv[2];

  runValidation(testCaseId)
    .then((result) => {
      console.log('\nValidation Results:');
      console.log(JSON.stringify(result, null, 2));

      // Write results to file
      const outputPath = path.join(__dirname, '../../validation-results/complete-mcp-data-flow.json');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      console.log(`\nResults written to: ${outputPath}`);

      process.exit(result.failed === 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error('Validation harness failed:', error);
      process.exit(1);
    });
}

// Matcher utilities for expectedOutput validation
const expect = {
  any: (type: any) => ({ __type: 'any', constructor: type }),
  arrayContaining: (items: any[]) => ({ __type: 'arrayContaining', items }),
  objectContaining: (props: any) => ({ __type: 'objectContaining', props }),
  stringContaining: (substr: string) => ({ __type: 'stringContaining', substr }),
};
