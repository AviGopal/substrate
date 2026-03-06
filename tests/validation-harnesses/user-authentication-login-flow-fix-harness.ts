/**
 * Validation Harness: user-authentication-login-flow-fix
 * 
 * Multi-stage validation for authentication flow:
 * Stage 1: User creation via CLI
 * Stage 2: Database verification (SurrealDB query)
 * Stage 3: Login endpoint validation (HTTP POST)
 * Stage 4: JWT token validation
 * Stage 5: Protected route access (/cloud/activity)
 * Stage 6: Playwright end-to-end test
 * 
 * This harness is LLM-free and can be run programmatically for regression testing.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

// Note: Runtime dependencies (axios, jsonwebtoken) installed via npm in test environment
// These imports will resolve when the validation harness is executed
const axios = require('axios');
const jwt = require('jsonwebtoken');

const execAsync = promisify(exec);

interface ValidationInput {
  email: string;
  password: string;
  name: string;
  orgId: string;
  role: string;
  rpcApiUrl: string;
  dashboardUrl: string;
  namespace: string;
}

interface ValidationOutput {
  pass: boolean;
  stages: {
    userCreation: StageResult;
    databaseVerification: StageResult;
    loginEndpoint: StageResult;
    jwtValidation: StageResult;
    protectedRoute: StageResult;
    playwrightE2E: StageResult;
  };
  actual: any;
  expected: any;
  errors: string[];
}

interface StageResult {
  pass: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * Stage 1: Create user via CLI
 */
async function validateUserCreation(input: ValidationInput): Promise<StageResult> {
  try {
    const podName = await getPodName(input.namespace, 'metabob-rpc-api');
    
    const cmd = `kubectl exec -n ${input.namespace} ${podName} -- python3 -c "
import asyncio
from server.db.operations.user_ops import create_user

async def test_create():
    result = await create_user(
        email='${input.email}',
        password='${input.password}',
        name='${input.name}',
        org_id='${input.orgId}',
        role='${input.role}'
    )
    print(result)

asyncio.run(test_create())
"`;

    const { stdout, stderr } = await execAsync(cmd);
    
    if (stderr && stderr.includes('Error')) {
      return {
        pass: false,
        message: 'User creation failed',
        error: stderr,
      };
    }

    // Check if user was created
    if (stdout.includes(input.email)) {
      return {
        pass: true,
        message: 'User created successfully',
        data: { output: stdout },
      };
    }

    return {
      pass: false,
      message: 'User creation output unexpected',
      data: { stdout, stderr },
    };
  } catch (error) {
    return {
      pass: false,
      message: 'User creation command failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Stage 2: Verify user exists in SurrealDB
 */
async function validateDatabaseVerification(input: ValidationInput): Promise<StageResult> {
  try {
    const podName = await getPodName(input.namespace, 'metabob-rpc-api');
    
    const cmd = `kubectl exec -n ${input.namespace} ${podName} -- python3 -c "
import asyncio
from server.db.surrealdb_client import get_surreal_client

async def test_query():
    db = await get_surreal_client()
    result = await db.query(
        'SELECT * FROM users WHERE email = \\$email',
        {'email': '${input.email}'}
    )
    print(result)

asyncio.run(test_query())
"`;

    const { stdout, stderr } = await execAsync(cmd);
    
    if (stderr && stderr.includes('Error')) {
      return {
        pass: false,
        message: 'Database query failed',
        error: stderr,
      };
    }

    // Parse result to check if user exists
    if (stdout.includes(input.email) && stdout.includes('user_id')) {
      return {
        pass: true,
        message: 'User found in database',
        data: { queryResult: stdout },
      };
    }

    return {
      pass: false,
      message: 'User not found in database',
      data: { stdout, stderr },
    };
  } catch (error) {
    return {
      pass: false,
      message: 'Database verification failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Stage 3: Test login endpoint
 */
async function validateLoginEndpoint(input: ValidationInput): Promise<StageResult> {
  try {
    const response = await axios.post(
      `${input.rpcApiUrl}/auth/login`,
      {
        email: input.email,
        password: input.password,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        validateStatus: () => true, // Don't throw on non-2xx
      }
    );

    if (response.status !== 200) {
      return {
        pass: false,
        message: `Login returned ${response.status} instead of 200`,
        data: { status: response.status, body: response.data },
      };
    }

    if (!response.data.token) {
      return {
        pass: false,
        message: 'Login response missing JWT token',
        data: response.data,
      };
    }

    if (!response.data.user || response.data.user.email !== input.email) {
      return {
        pass: false,
        message: 'Login response user data incorrect',
        data: response.data,
      };
    }

    return {
      pass: true,
      message: 'Login endpoint returned valid response',
      data: {
        token: response.data.token,
        user: response.data.user,
        organizations: response.data.organizations,
      },
    };
  } catch (error) {
    return {
      pass: false,
      message: 'Login endpoint request failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Stage 4: Validate JWT token structure
 */
async function validateJwtToken(token: string, input: ValidationInput): Promise<StageResult> {
  try {
    // Decode without verification (just structure check)
    const decoded = jwt.decode(token) as any;

    if (!decoded) {
      return {
        pass: false,
        message: 'JWT token could not be decoded',
      };
    }

    // Check required fields
    const requiredFields = ['user_id', 'email', 'org_id', 'role', 'exp'];
    const missingFields = requiredFields.filter(field => !(field in decoded));

    if (missingFields.length > 0) {
      return {
        pass: false,
        message: `JWT missing required fields: ${missingFields.join(', ')}`,
        data: decoded,
      };
    }

    // Check email matches
    if (decoded.email !== input.email) {
      return {
        pass: false,
        message: `JWT email mismatch: expected ${input.email}, got ${decoded.email}`,
        data: decoded,
      };
    }

    // Check token not expired
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) {
      return {
        pass: false,
        message: 'JWT token is expired',
        data: decoded,
      };
    }

    return {
      pass: true,
      message: 'JWT token structure valid',
      data: decoded,
    };
  } catch (error) {
    return {
      pass: false,
      message: 'JWT validation failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Stage 5: Test protected route access
 */
async function validateProtectedRoute(token: string, input: ValidationInput): Promise<StageResult> {
  try {
    const response = await axios.get(
      `${input.rpcApiUrl}/cloud/activity`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      }
    );

    if (response.status === 401) {
      return {
        pass: false,
        message: 'Protected route returned 401 Unauthorized',
        data: response.data,
      };
    }

    if (response.status !== 200) {
      return {
        pass: false,
        message: `Protected route returned ${response.status}`,
        data: { status: response.status, body: response.data },
      };
    }

    return {
      pass: true,
      message: 'Protected route accessible with JWT',
      data: { status: response.status, activityCount: response.data?.length || 0 },
    };
  } catch (error) {
    return {
      pass: false,
      message: 'Protected route request failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Stage 6: Playwright end-to-end test
 */
async function validatePlaywrightE2E(input: ValidationInput): Promise<StageResult> {
  try {
    // Create a simple Playwright test script
    const testScript = `
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto('${input.dashboardUrl}/login');
    await page.waitForLoadState('networkidle');

    // Fill login form
    await page.fill('input[name="email"]', '${input.email}');
    await page.fill('input[name="password"]', '${input.password}');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/cloud/dashboard', { timeout: 10000 });

    // Navigate to activity page
    await page.goto('${input.dashboardUrl}/cloud/activity');
    await page.waitForLoadState('networkidle');

    // Check for activity table
    const activityTable = await page.locator('table').count();
    
    if (activityTable === 0) {
      throw new Error('Activity table not found');
    }

    // Take screenshot
    await page.screenshot({ path: 'screenshots/activity-page-validation.png', fullPage: true });

    console.log('SUCCESS');
    await browser.close();
  } catch (error) {
    console.error('ERROR:', error.message);
    await browser.close();
    process.exit(1);
  }
})();
`;

    // Write test script to temporary file
    const fs = require('fs');
    const tempFile = '/tmp/pw-validation-test.js';
    fs.writeFileSync(tempFile, testScript);

    // Run Playwright test
    const { stdout, stderr } = await execAsync(`node ${tempFile}`);

    if (stdout.includes('SUCCESS')) {
      return {
        pass: true,
        message: 'Playwright E2E test passed',
        data: { screenshot: 'screenshots/activity-page-validation.png' },
      };
    }

    return {
      pass: false,
      message: 'Playwright E2E test failed',
      error: stderr || stdout,
    };
  } catch (error) {
    return {
      pass: false,
      message: 'Playwright E2E test execution failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Helper: Get pod name for a deployment
 */
async function getPodName(namespace: string, appName: string): Promise<string> {
  const { stdout } = await execAsync(
    `kubectl get pods -n ${namespace} -l app.kubernetes.io/name=${appName} -o jsonpath='{.items[0].metadata.name}'`
  );
  
  if (!stdout) {
    // Fallback: search by name pattern
    const { stdout: fallbackStdout } = await execAsync(
      `kubectl get pods -n ${namespace} | grep ${appName} | grep Running | head -1 | awk '{print $1}'`
    );
    return fallbackStdout.trim();
  }
  
  return stdout.trim();
}

/**
 * Main validation runner
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const errors: string[] = [];
  const stages: ValidationOutput['stages'] = {
    userCreation: { pass: false, message: 'Not run' },
    databaseVerification: { pass: false, message: 'Not run' },
    loginEndpoint: { pass: false, message: 'Not run' },
    jwtValidation: { pass: false, message: 'Not run' },
    protectedRoute: { pass: false, message: 'Not run' },
    playwrightE2E: { pass: false, message: 'Not run' },
  };

  // Stage 1: User Creation
  console.log('Stage 1: Creating test user...');
  stages.userCreation = await validateUserCreation(input);
  if (!stages.userCreation.pass) {
    errors.push(`Stage 1 Failed: ${stages.userCreation.message}`);
  }

  // Stage 2: Database Verification
  console.log('Stage 2: Verifying user in database...');
  stages.databaseVerification = await validateDatabaseVerification(input);
  if (!stages.databaseVerification.pass) {
    errors.push(`Stage 2 Failed: ${stages.databaseVerification.message}`);
  }

  // Stage 3: Login Endpoint
  console.log('Stage 3: Testing login endpoint...');
  stages.loginEndpoint = await validateLoginEndpoint(input);
  if (!stages.loginEndpoint.pass) {
    errors.push(`Stage 3 Failed: ${stages.loginEndpoint.message}`);
    // Can't proceed without token
    return {
      pass: false,
      stages,
      actual: { stages },
      expected: { allStagesPassed: true },
      errors,
    };
  }

  const token = stages.loginEndpoint.data?.token;
  if (!token) {
    errors.push('Stage 3: No token received');
    return {
      pass: false,
      stages,
      actual: { stages },
      expected: { allStagesPassed: true },
      errors,
    };
  }

  // Stage 4: JWT Validation
  console.log('Stage 4: Validating JWT token...');
  stages.jwtValidation = await validateJwtToken(token, input);
  if (!stages.jwtValidation.pass) {
    errors.push(`Stage 4 Failed: ${stages.jwtValidation.message}`);
  }

  // Stage 5: Protected Route
  console.log('Stage 5: Testing protected route access...');
  stages.protectedRoute = await validateProtectedRoute(token, input);
  if (!stages.protectedRoute.pass) {
    errors.push(`Stage 5 Failed: ${stages.protectedRoute.message}`);
  }

  // Stage 6: Playwright E2E
  console.log('Stage 6: Running Playwright end-to-end test...');
  stages.playwrightE2E = await validatePlaywrightE2E(input);
  if (!stages.playwrightE2E.pass) {
    errors.push(`Stage 6 Failed: ${stages.playwrightE2E.message}`);
  }

  // Overall pass/fail
  const allStagesPassed = Object.values(stages).every(stage => stage.pass);

  return {
    pass: allStagesPassed,
    stages,
    actual: { stages },
    expected: { allStagesPassed: true },
    errors,
  };
}

/**
 * CLI runner
 */
if (require.main === module) {
  const defaultInput: ValidationInput = {
    email: 'validation-test@metabob.com',
    password: 'validation123',
    name: 'Validation Test User',
    orgId: 'metabob_org',
    role: 'member',
    rpcApiUrl: 'http://localhost:8080',
    dashboardUrl: 'http://devbob.metabob.local',
    namespace: 'metabob',
  };

  runValidation(defaultInput)
    .then(result => {
      console.log('\n=== VALIDATION RESULTS ===');
      console.log(`Overall: ${result.pass ? 'PASS ✅' : 'FAIL ❌'}`);
      console.log('\nStage Results:');
      
      Object.entries(result.stages).forEach(([name, stage]) => {
        console.log(`  ${name}: ${stage.pass ? 'PASS ✅' : 'FAIL ❌'} - ${stage.message}`);
        if (stage.error) {
          console.log(`    Error: ${stage.error}`);
        }
      });

      if (result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach(error => console.log(`  - ${error}`));
      }

      process.exit(result.pass ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation harness failed:', error);
      process.exit(1);
    });
}
