/**
 * JWT Flow Debug Test
 *
 * Traces JWT authentication through:
 * 1. Login to analysis-api → get JWT with org_id
 * 2. Decode JWT to verify claims
 * 3. Use JWT with activity-api to verify $auth population
 * 4. Create execution trace with JWT auth to verify org_id propagation
 */

const ANALYSIS_API = process.env.ANALYSIS_API || 'http://api.metabob.local';
const ACTIVITY_API = process.env.ACTIVITY_API || 'http://activity.metabob.local';

const TEST_USER = {
  email: 'test@metabob.local',
  password: 'testpass123'
};

function decodeJwt(token: string): { header: any; payload: any; signature: string } {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  return {
    header: JSON.parse(Buffer.from(parts[0], 'base64url').toString()),
    payload: JSON.parse(Buffer.from(parts[1], 'base64url').toString()),
    signature: parts[2]
  };
}

async function step1_login(): Promise<string> {
  console.log('\n=== STEP 1: Login to Analysis API ===\n');

  const response = await fetch(`${ANALYSIS_API}/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER)
  });

  console.log(`Status: ${response.status}`);

  if (!response.ok) {
    const text = await response.text();
    console.log(`Error: ${text}`);
    throw new Error(`Login failed: ${response.status}`);
  }

  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));

  if (!data.success || !data.data?.token) {
    throw new Error('No token in response');
  }

  return data.data.token;
}

function step2_decodeJwt(token: string): any {
  console.log('\n=== STEP 2: Decode JWT Token ===\n');

  const decoded = decodeJwt(token);
  console.log('Header:', JSON.stringify(decoded.header, null, 2));
  console.log('Payload:', JSON.stringify(decoded.payload, null, 2));

  console.log('\n--- Key Claims ---');
  console.log(`user_id: ${decoded.payload.user_id}`);
  console.log(`org_id:  ${decoded.payload.org_id}`);
  console.log(`role:    ${decoded.payload.role}`);
  console.log(`exp:     ${new Date(decoded.payload.exp * 1000).toISOString()}`);

  return decoded.payload;
}

async function step3_verifyWithActivityApi(token: string): Promise<void> {
  console.log('\n=== STEP 3: Verify JWT with Activity API ===\n');

  // First, check health
  const healthResponse = await fetch(`${ACTIVITY_API}/health`);
  console.log(`Health check: ${healthResponse.status}`);
  const healthData = await healthResponse.json();
  console.log('Health:', JSON.stringify(healthData, null, 2));

  // Try to fetch execution traces with JWT auth
  console.log('\n--- Fetching execution traces with JWT ---');
  const tracesResponse = await fetch(`${ACTIVITY_API}/v2/activities/execution-traces?limit=5`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  console.log(`Execution traces status: ${tracesResponse.status}`);
  const tracesData = await tracesResponse.json();
  console.log('Response:', JSON.stringify(tracesData, null, 2));
}

async function step4_createExecutionTrace(token: string, orgIdFromJwt: string): Promise<void> {
  console.log('\n=== STEP 4: Create Execution Trace with JWT Auth ===\n');

  const executionId = `jwt-test-${Date.now()}`;
  const trace = {
    execution_id: executionId,
    template_id: 'jwt-flow-test-template',
    activity_id: 'jwt-flow-test-activity',
    status: 'completed',
    success: true,
    duration_ms: 1500,
    cost_usd: 0.003,
    tokens: {
      input: 500,
      output: 200,
      cache: 50
    }
  };

  console.log('Request body:', JSON.stringify(trace, null, 2));

  const response = await fetch(`${ACTIVITY_API}/v2/activities/execution-traces`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(trace)
  });

  console.log(`\nCreate response status: ${response.status}`);
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));

  if (response.ok && data.trace) {
    console.log('\n--- Stored Trace Analysis ---');
    console.log(`execution_id: ${data.trace.execution_id}`);
    console.log(`org_id from trace: ${data.trace.org_id}`);
    console.log(`org_id from JWT:   ${orgIdFromJwt}`);

    if (data.trace.org_id) {
      console.log('\n✅ SUCCESS: org_id was properly propagated from JWT!');
    } else {
      console.log('\n❌ FAILURE: org_id is null/undefined despite JWT containing it');
      console.log('This indicates the jwtAuth middleware is not extracting claims properly');
    }
  }
}

async function step5_verifyStoredTrace(token: string, executionId: string): Promise<void> {
  console.log('\n=== STEP 5: Verify Stored Trace via GET ===\n');

  const response = await fetch(`${ACTIVITY_API}/v2/activities/execution-traces?limit=10`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  console.log(`Status: ${response.status}`);
  const data = await response.json();

  console.log(`Total traces: ${data.total}`);
  console.log('Recent traces:');
  for (const trace of data.executions || []) {
    console.log(`  - ${trace.execution_id}: org_id=${trace.org_id}, success=${trace.success}`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║             JWT FLOW DEBUG TEST                                ║');
  console.log('║   Testing org_id propagation through Analysis -> Activity API  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  console.log(`\nAnalysis API: ${ANALYSIS_API}`);
  console.log(`Activity API: ${ACTIVITY_API}`);

  try {
    // Step 1: Login and get JWT
    const token = await step1_login();

    // Step 2: Decode and verify JWT claims
    const jwtPayload = step2_decodeJwt(token);
    const orgIdFromJwt = jwtPayload.org_id;

    if (!orgIdFromJwt) {
      console.log('\n❌ CRITICAL: JWT does not contain org_id claim!');
      console.log('The analysis-api is not setting org_id in the token.');
      return;
    }

    // Step 3: Verify with Activity API
    await step3_verifyWithActivityApi(token);

    // Step 4: Create execution trace
    await step4_createExecutionTrace(token, orgIdFromJwt);

    // Step 5: Verify stored trace
    await step5_verifyStoredTrace(token, `jwt-test-${Date.now()}`);

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('                        TEST COMPLETE');
    console.log('════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
