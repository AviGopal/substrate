/**
 * Validation Harness: Structured Logging Data Flow Tracing
 * 
 * Tests that structured logging implementation correctly traces authentication flow
 * and provides diagnostic information for 401 errors.
 * 
 * Specification: structured-logging-data-flow-tracing
 * 
 * Test Strategy:
 * 1. Start metabob-rpc-api with structured logging enabled (LOG_FORMAT=json)
 * 2. Execute login attempts (success, user not found, invalid password)
 * 3. Capture and parse JSON log output
 * 4. Verify required fields exist at each stage
 * 5. Verify correlation IDs link logs together
 * 6. Verify failure reasons are clearly logged
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

interface LogEntry {
  timestamp: string;
  level: string;
  logger: string;
  message: string;
  correlation_id?: string;
  stage?: string;
  [key: string]: any;
}

interface ValidationResult {
  pass: boolean;
  actual: any;
  expected: any;
  errors: string[];
  details?: any;
}

interface TestCase {
  name: string;
  input: {
    email: string;
    password: string;
  };
  expectedStages: string[];
  expectedFinalStage: string;
  expectedReason?: string;
}

class StructuredLoggingValidator {
  private rpcProcess: ChildProcess | null = null;
  private logs: LogEntry[] = [];
  private baseUrl: string = 'http://localhost:8001';
  private logBuffer: string = '';

  /**
   * Start metabob-rpc-api with structured logging enabled
   */
  async startRpcApi(): Promise<void> {
    return new Promise((resolve, reject) => {
      const rpcDir = path.join(__dirname, '../../repos/metabob-rpc-api');
      
      console.log(`Starting RPC API from ${rpcDir}...`);
      
      // Set environment variables for structured logging
      const env = {
        ...process.env,
        LOG_FORMAT: 'json',
        LOG_LEVEL: 'DEBUG',
        ENABLE_CORRELATION_ID: 'true',
        SURREALDB_URL: process.env.SURREALDB_URL || 'http://localhost:8000',
        SURREALDB_NAMESPACE: 'metabob',
        SURREALDB_DATABASE: 'learning_loop',
      };
      
      // Start the server
      this.rpcProcess = spawn('python', ['-m', 'uvicorn', 'server.app:create_app', '--factory', '--host', '0.0.0.0', '--port', '8001'], {
        cwd: rpcDir,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      
      // Capture stdout (logs)
      this.rpcProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        this.logBuffer += output;
        console.log('[RPC-API STDOUT]:', output);
      });
      
      // Capture stderr (errors)
      this.rpcProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        console.error('[RPC-API STDERR]:', output);
      });
      
      this.rpcProcess.on('error', (error) => {
        reject(new Error(`Failed to start RPC API: ${error.message}`));
      });
      
      // Wait for server to be ready
      setTimeout(async () => {
        try {
          await this.waitForHealth();
          console.log('RPC API is ready');
          resolve();
        } catch (error) {
          reject(error);
        }
      }, 3000);
    });
  }

  /**
   * Wait for health endpoint to respond
   */
  async waitForHealth(maxRetries: number = 10): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await axios.get(`${this.baseUrl}/health`, { timeout: 2000 });
        if (response.status === 200) {
          return;
        }
      } catch (error) {
        console.log(`Health check attempt ${i + 1}/${maxRetries} failed, retrying...`);
        await this.sleep(2000);
      }
    }
    throw new Error('RPC API failed to become healthy');
  }

  /**
   * Stop metabob-rpc-api
   */
  async stopRpcApi(): Promise<void> {
    if (this.rpcProcess) {
      this.rpcProcess.kill('SIGTERM');
      await this.sleep(2000);
      if (this.rpcProcess.exitCode === null) {
        this.rpcProcess.kill('SIGKILL');
      }
      this.rpcProcess = null;
    }
  }

  /**
   * Parse accumulated logs into structured log entries
   */
  parseLogs(): LogEntry[] {
    const lines = this.logBuffer.split('\n').filter(line => line.trim());
    const logs: LogEntry[] = [];
    
    for (const line of lines) {
      try {
        // Try to parse as JSON
        const logEntry = JSON.parse(line);
        logs.push(logEntry);
      } catch (error) {
        // Not JSON, might be text format or non-log output
        // Skip text logs for this validation
      }
    }
    
    return logs;
  }

  /**
   * Attempt login and capture correlation ID from response
   */
  async attemptLogin(email: string, password: string): Promise<{ correlationId: string | null; statusCode: number; response: any }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/auth/login`,
        { email, password },
        { 
          validateStatus: () => true, // Don't throw on non-2xx
          timeout: 10000 
        }
      );
      
      const correlationId = response.headers['x-correlation-id'] || null;
      
      return {
        correlationId,
        statusCode: response.status,
        response: response.data,
      };
    } catch (error: any) {
      console.error(`Login attempt failed: ${error.message}`);
      return {
        correlationId: null,
        statusCode: error.response?.status || 0,
        response: error.response?.data || null,
      };
    }
  }

  /**
   * Filter logs by correlation ID
   */
  filterLogsByCorrelationId(correlationId: string): LogEntry[] {
    return this.parseLogs().filter(log => log.correlation_id === correlationId);
  }

  /**
   * Validate that required fields exist in logs for specific stages
   */
  validateLogStages(logs: LogEntry[], expectedStages: string[]): { pass: boolean; errors: string[] } {
    const errors: string[] = [];
    const foundStages = logs.map(log => log.stage).filter(Boolean);
    
    for (const expectedStage of expectedStages) {
      if (!foundStages.includes(expectedStage)) {
        errors.push(`Expected stage '${expectedStage}' not found in logs`);
      }
    }
    
    return {
      pass: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate AUTH_START log has required fields
   */
  validateAuthStart(log: LogEntry): { pass: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!log.email && !log.message.includes('email')) {
      errors.push('AUTH_START log missing email information');
    }
    
    if (!log.correlation_id) {
      errors.push('AUTH_START log missing correlation_id');
    }
    
    if (log.stage !== 'AUTH_START') {
      errors.push(`Expected stage AUTH_START, got ${log.stage}`);
    }
    
    return { pass: errors.length === 0, errors };
  }

  /**
   * Validate DB_QUERY_USER log has required fields
   */
  validateDbQueryUser(logs: LogEntry[]): { pass: boolean; errors: string[] } {
    const errors: string[] = [];
    const startLog = logs.find(log => log.stage === 'DB_QUERY_USER_START');
    const completeLog = logs.find(log => log.stage === 'DB_QUERY_USER_COMPLETE');
    
    if (!startLog) {
      errors.push('DB_QUERY_USER_START log not found');
    } else {
      if (!startLog.query && !startLog.message.includes('query')) {
        errors.push('DB_QUERY_USER_START missing query information');
      }
    }
    
    if (!completeLog) {
      errors.push('DB_QUERY_USER_COMPLETE log not found');
    } else {
      if (typeof completeLog.execution_time_ms === 'undefined') {
        errors.push('DB_QUERY_USER_COMPLETE missing execution_time_ms');
      }
      if (typeof completeLog.result_count === 'undefined') {
        errors.push('DB_QUERY_USER_COMPLETE missing result_count');
      }
    }
    
    return { pass: errors.length === 0, errors };
  }

  /**
   * Validate PASSWORD_VERIFY log has required fields
   */
  validatePasswordVerify(logs: LogEntry[]): { pass: boolean; errors: string[] } {
    const errors: string[] = [];
    const startLog = logs.find(log => log.stage === 'PASSWORD_VERIFY_START');
    const completeLog = logs.find(log => log.stage === 'PASSWORD_VERIFY_COMPLETE');
    
    if (!startLog) {
      errors.push('PASSWORD_VERIFY_START log not found');
    } else {
      if (!startLog.user_id && !startLog.message.includes('user')) {
        errors.push('PASSWORD_VERIFY_START missing user_id');
      }
    }
    
    if (completeLog) {
      if (typeof completeLog.verification_time_ms === 'undefined') {
        errors.push('PASSWORD_VERIFY_COMPLETE missing verification_time_ms');
      }
    }
    
    return { pass: errors.length === 0, errors };
  }

  /**
   * Validate AUTH_FAILURE log has required fields
   */
  validateAuthFailure(log: LogEntry, expectedReason: string): { pass: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (log.stage !== 'AUTH_FAILURE') {
      errors.push(`Expected stage AUTH_FAILURE, got ${log.stage}`);
    }
    
    if (!log.reason) {
      errors.push('AUTH_FAILURE log missing reason field');
    } else if (log.reason !== expectedReason) {
      errors.push(`Expected reason '${expectedReason}', got '${log.reason}'`);
    }
    
    if (!log.error_stage) {
      errors.push('AUTH_FAILURE log missing error_stage field');
    }
    
    if (typeof log.total_duration_ms === 'undefined') {
      errors.push('AUTH_FAILURE log missing total_duration_ms');
    }
    
    if (!log.correlation_id) {
      errors.push('AUTH_FAILURE log missing correlation_id');
    }
    
    return { pass: errors.length === 0, errors };
  }

  /**
   * Validate AUTH_SUCCESS log has required fields
   */
  validateAuthSuccess(log: LogEntry): { pass: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (log.stage !== 'AUTH_SUCCESS') {
      errors.push(`Expected stage AUTH_SUCCESS, got ${log.stage}`);
    }
    
    if (!log.user_id) {
      errors.push('AUTH_SUCCESS log missing user_id');
    }
    
    if (typeof log.org_count === 'undefined') {
      errors.push('AUTH_SUCCESS log missing org_count');
    }
    
    if (typeof log.total_duration_ms === 'undefined') {
      errors.push('AUTH_SUCCESS log missing total_duration_ms');
    }
    
    if (!log.correlation_id) {
      errors.push('AUTH_SUCCESS log missing correlation_id');
    }
    
    return { pass: errors.length === 0, errors };
  }

  /**
   * Verify all logs for a request have the same correlation ID
   */
  validateCorrelationIdConsistency(logs: LogEntry[]): { pass: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (logs.length === 0) {
      errors.push('No logs found to validate');
      return { pass: false, errors };
    }
    
    const correlationIds = new Set(logs.map(log => log.correlation_id).filter(Boolean));
    
    if (correlationIds.size === 0) {
      errors.push('No correlation IDs found in logs');
    } else if (correlationIds.size > 1) {
      errors.push(`Multiple correlation IDs found: ${Array.from(correlationIds).join(', ')}`);
    }
    
    return { pass: errors.length === 0, errors };
  }

  /**
   * Run a single test case
   */
  async runTestCase(testCase: TestCase): Promise<ValidationResult> {
    console.log(`\n=== Running Test Case: ${testCase.name} ===`);
    
    // Clear previous logs
    this.logBuffer = '';
    
    // Wait a bit for previous logs to settle
    await this.sleep(1000);
    
    // Attempt login
    const loginResult = await this.attemptLogin(testCase.input.email, testCase.input.password);
    
    console.log(`Login Status: ${loginResult.statusCode}`);
    console.log(`Correlation ID: ${loginResult.correlationId || 'NOT FOUND'}`);
    
    // Wait for logs to be written
    await this.sleep(2000);
    
    // Parse logs
    const allLogs = this.parseLogs();
    console.log(`Total logs captured: ${allLogs.length}`);
    
    // Filter logs by correlation ID
    const requestLogs = loginResult.correlationId 
      ? this.filterLogsByCorrelationId(loginResult.correlationId)
      : [];
    
    console.log(`Logs for this request: ${requestLogs.length}`);
    
    const errors: string[] = [];
    
    // Validate correlation ID in response header
    if (!loginResult.correlationId) {
      errors.push('X-Correlation-ID header not found in response');
    }
    
    // Validate correlation ID consistency
    const correlationResult = this.validateCorrelationIdConsistency(requestLogs);
    if (!correlationResult.pass) {
      errors.push(...correlationResult.errors);
    }
    
    // Validate expected stages are logged
    const stagesResult = this.validateLogStages(requestLogs, testCase.expectedStages);
    if (!stagesResult.pass) {
      errors.push(...stagesResult.errors);
    }
    
    // Validate final stage (AUTH_SUCCESS or AUTH_FAILURE)
    const finalLog = requestLogs.find(log => log.stage === testCase.expectedFinalStage);
    if (!finalLog) {
      errors.push(`Expected final stage '${testCase.expectedFinalStage}' not found`);
    } else {
      if (testCase.expectedFinalStage === 'AUTH_FAILURE' && testCase.expectedReason) {
        const failureResult = this.validateAuthFailure(finalLog, testCase.expectedReason);
        if (!failureResult.pass) {
          errors.push(...failureResult.errors);
        }
      } else if (testCase.expectedFinalStage === 'AUTH_SUCCESS') {
        const successResult = this.validateAuthSuccess(finalLog);
        if (!successResult.pass) {
          errors.push(...successResult.errors);
        }
      }
    }
    
    // Validate specific stage logs
    if (requestLogs.some(log => log.stage?.startsWith('DB_QUERY_USER'))) {
      const dbQueryResult = this.validateDbQueryUser(requestLogs);
      if (!dbQueryResult.pass) {
        errors.push(...dbQueryResult.errors);
      }
    }
    
    if (requestLogs.some(log => log.stage?.startsWith('PASSWORD_VERIFY'))) {
      const passwordResult = this.validatePasswordVerify(requestLogs);
      if (!passwordResult.pass) {
        errors.push(...passwordResult.errors);
      }
    }
    
    return {
      pass: errors.length === 0,
      actual: {
        statusCode: loginResult.statusCode,
        correlationId: loginResult.correlationId,
        logCount: requestLogs.length,
        stages: requestLogs.map(log => log.stage).filter(Boolean),
        finalStage: finalLog?.stage,
        reason: finalLog?.reason,
      },
      expected: {
        expectedStages: testCase.expectedStages,
        expectedFinalStage: testCase.expectedFinalStage,
        expectedReason: testCase.expectedReason,
      },
      errors,
      details: {
        logs: requestLogs,
      },
    };
  }

  /**
   * Helper to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Main validation function
 */
export async function runValidation(): Promise<ValidationResult> {
  const validator = new StructuredLoggingValidator();
  
  try {
    console.log('Starting structured logging validation...\n');
    
    // Start RPC API with structured logging
    await validator.startRpcApi();
    
    // Define test cases
    const testCases: TestCase[] = [
      {
        name: 'Valid Login - Success Case',
        input: {
          email: 'test@example.com',
          password: 'correct-password',
        },
        expectedStages: [
          'AUTH_START',
          'DB_QUERY_USER_START',
          'DB_QUERY_USER_COMPLETE',
          'USER_FOUND',
          'PASSWORD_VERIFY_START',
          'PASSWORD_VERIFY_COMPLETE',
          'AUTH_SUCCESS',
        ],
        expectedFinalStage: 'AUTH_SUCCESS',
      },
      {
        name: 'User Not Found - Failure Case',
        input: {
          email: 'nonexistent@example.com',
          password: 'any-password',
        },
        expectedStages: [
          'AUTH_START',
          'DB_QUERY_USER_START',
          'DB_QUERY_USER_COMPLETE',
          'AUTH_FAILURE',
        ],
        expectedFinalStage: 'AUTH_FAILURE',
        expectedReason: 'USER_NOT_FOUND',
      },
      {
        name: 'Invalid Password - Failure Case',
        input: {
          email: 'test@example.com',
          password: 'wrong-password',
        },
        expectedStages: [
          'AUTH_START',
          'DB_QUERY_USER_START',
          'DB_QUERY_USER_COMPLETE',
          'USER_FOUND',
          'PASSWORD_VERIFY_START',
          'AUTH_FAILURE',
        ],
        expectedFinalStage: 'AUTH_FAILURE',
        expectedReason: 'INVALID_PASSWORD',
      },
    ];
    
    // Run all test cases
    const results: ValidationResult[] = [];
    for (const testCase of testCases) {
      const result = await validator.runTestCase(testCase);
      results.push(result);
      
      console.log(`\nResult: ${result.pass ? 'PASS' : 'FAIL'}`);
      if (!result.pass) {
        console.log('Errors:');
        result.errors.forEach(error => console.log(`  - ${error}`));
      }
    }
    
    // Stop RPC API
    await validator.stopRpcApi();
    
    // Aggregate results
    const allPassed = results.every(r => r.pass);
    const allErrors = results.flatMap(r => r.errors);
    
    return {
      pass: allPassed,
      actual: {
        testCount: results.length,
        passedCount: results.filter(r => r.pass).length,
        failedCount: results.filter(r => !r.pass).length,
        results,
      },
      expected: {
        testCount: testCases.length,
        allPass: true,
      },
      errors: allErrors,
    };
    
  } catch (error: any) {
    console.error('Validation failed with exception:', error);
    await validator.stopRpcApi();
    
    return {
      pass: false,
      actual: { error: error.message },
      expected: { noErrors: true },
      errors: [error.message],
    };
  }
}

// Run validation if executed directly
if (require.main === module) {
  runValidation()
    .then(result => {
      console.log('\n=== VALIDATION COMPLETE ===');
      console.log(`Overall Result: ${result.pass ? 'PASS' : 'FAIL'}`);
      process.exit(result.pass ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
