/**
 * Simple validation runner for WebSocket Real-Time Dashboard Updates
 */

// Test connecting to WebSocket and triggering execution
const WebSocket = require('ws');

async function testWebSocketConnection() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:8080/ws');
    let authenticated = false;
    const messages = [];

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Connection timeout after 5s'));
    }, 5000);

    ws.on('open', () => {
      console.log('[WebSocket] Connected');
      // Send authentication
      ws.send(JSON.stringify({
        type: 'authenticate',
        token: 'test-token'
      }));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        messages.push(message);
        console.log('[WebSocket] Received:', message.type);

        if (message.type === 'authenticated') {
          authenticated = true;
          clearTimeout(timeout);
          ws.close();
          resolve({ authenticated: true, messages });
        }
      } catch (error) {
        console.error('[WebSocket] Parse error:', error.message);
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    ws.on('close', () => {
      if (!authenticated) {
        clearTimeout(timeout);
        reject(new Error('Connection closed before authentication'));
      }
    });
  });
}

async function triggerExecution() {
  const response = await fetch('http://localhost:8080/v2/activities/executions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
    body: JSON.stringify({
      variant_id: 'test-websocket-validation',
      success: true,
      duration_ms: 1000,
      cost: 0.01,
      tokens: {
        input: 100,
        output: 50,
        cache: 0
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Execution failed: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function main() {
  console.log('================================================================================');
  console.log('WebSocket Real-Time Dashboard Updates - Simple Validation');
  console.log('================================================================================\n');

  try {
    // Test 1: WebSocket Connection and Authentication
    console.log('[Test 1] Testing WebSocket connection and authentication...');
    const connectionResult = await testWebSocketConnection();
    console.log('[Test 1] ✅ PASS - WebSocket connected and authenticated');
    console.log('         Authenticated:', connectionResult.authenticated);
    console.log('         Messages received:', connectionResult.messages.length);

    // Test 2: Trigger Execution
    console.log('\n[Test 2] Triggering test execution...');
    const executionResult = await triggerExecution();
    console.log('[Test 2] ✅ PASS - Execution triggered successfully');
    console.log('         Execution ID:', executionResult.execution_id);
    console.log('         Success:', executionResult.success);

    console.log('\n================================================================================');
    console.log('Overall Status: ✅ PASS');
    console.log('================================================================================\n');

    // Write results
    const results = {
      specificationName: 'WebSocket-Real-Time-Dashboard-Updates',
      timestamp: new Date().toISOString(),
      validationResults: [
        {
          testCase: 'websocket-connection-auth',
          status: 'PASS',
          details: 'WebSocket connected and authenticated successfully'
        },
        {
          testCase: 'execution-trigger',
          status: 'PASS',
          details: `Execution triggered: ${executionResult.execution_id}`
        }
      ],
      overallStatus: 'PASS'
    };

    require('fs').writeFileSync(
      'VALIDATION_RESULTS_WebSocket-Real-Time-Dashboard-Updates.json',
      JSON.stringify(results, null, 2)
    );

    return 0;

  } catch (error) {
    console.error('\n[ERROR]', error.message);
    console.log('\n================================================================================');
    console.log('Overall Status: ❌ FAIL');
    console.log('================================================================================\n');

    const results = {
      specificationName: 'WebSocket-Real-Time-Dashboard-Updates',
      timestamp: new Date().toISOString(),
      validationResults: [
        {
          testCase: 'websocket-validation',
          status: 'FAIL',
          details: error.message,
          error: error.stack
        }
      ],
      overallStatus: 'FAIL'
    };

    require('fs').writeFileSync(
      'VALIDATION_RESULTS_WebSocket-Real-Time-Dashboard-Updates.json',
      JSON.stringify(results, null, 2)
    );

    return 1;
  }
}

main().then(code => process.exit(code)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
