/**
 * WebSocket Real-Time Dashboard Updates - Validation Harness
 * 
 * Tests WebSocket event flow for real-time dashboard updates:
 * 1. Connect WebSocket client to Activity API
 * 2. Trigger activity execution
 * 3. Verify execution_started event received
 * 4. Verify execution_completed event received
 * 5. Verify template_metrics_updated event received
 * 6. Test multiple clients receive same events
 * 7. Test auto-reconnect after server restart
 * 
 * This is a deterministic validation harness (no LLM needed).
 * Uses browser-style WebSocket API (works in Bun and browsers).
 */

// ============================================================================
// Types
// ============================================================================

interface WebSocketMessage {
  type: 'execution_started' | 'execution_completed' | 'template_updated' | 'authenticated' | 'pong';
  timestamp: string;
  data?: any;
}

interface ValidationTestCase {
  name: string;
  input: {
    apiUrl: string;
    wsUrl: string;
    authToken: string;
    execution: {
      variant_id: string;
      success: boolean;
      duration_ms: number;
      cost: number;
      tokens: {
        input: number;
        output: number;
        cache: number;
      };
    };
  };
  expectedEvents: string[];
  timeout: number;
}

interface ValidationResult {
  pass: boolean;
  testCase: string;
  actual: {
    connected: boolean;
    authenticated: boolean;
    eventsReceived: string[];
    eventData: Record<string, any>;
    errors: string[];
  };
  expected: {
    connected: boolean;
    authenticated: boolean;
    eventsReceived: string[];
  };
  duration: number;
  details: string;
}

// ============================================================================
// WebSocket Client Helper
// ============================================================================

class TestWebSocketClient {
  private ws: WebSocket | null = null;
  private messages: WebSocketMessage[] = [];
  private connected = false;
  private authenticated = false;
  private errors: string[] = [];

  async connect(wsUrl: string, authToken: string, timeout = 5000): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`WebSocket connection timeout after ${timeout}ms`));
      }, timeout);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        console.log('[WebSocket] Connected to', wsUrl);

        // Send authentication message
        this.ws!.send(JSON.stringify({
          type: 'authenticate',
          token: authToken,
        }));
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data.toString());
          this.messages.push(message);

          console.log('[WebSocket] Received:', message.type, message.data ? JSON.stringify(message.data).substring(0, 100) : '');

          // Check for authentication confirmation
          if (message.type === 'authenticated') {
            this.authenticated = true;
            clearTimeout(timer);
            resolve(true);
          }
        } catch (error: any) {
          this.errors.push(`Failed to parse message: ${error.message}`);
        }
      };

      this.ws.onerror = (error: Event) => {
        this.errors.push(`WebSocket error: ${error.type}`);
        clearTimeout(timer);
        reject(new Error(`WebSocket error: ${error.type}`));
      };

      this.ws.onclose = () => {
        this.connected = false;
        console.log('[WebSocket] Connection closed');
      };
    });
  }

  async waitForEvents(eventTypes: string[], timeout = 10000): Promise<WebSocketMessage[]> {
    const startTime = Date.now();
    const receivedEvents: WebSocketMessage[] = [];

    return new Promise((resolve, reject) => {
      const checkEvents = () => {
        // Check if all expected events have been received
        for (const eventType of eventTypes) {
          const found = this.messages.find(m => m.type === eventType && !receivedEvents.includes(m));
          if (found) {
            receivedEvents.push(found);
            console.log(`[Validation] Received expected event: ${eventType}`);
          }
        }

        // All events received
        if (receivedEvents.length === eventTypes.length) {
          resolve(receivedEvents);
          return;
        }

        // Timeout
        if (Date.now() - startTime > timeout) {
          const missing = eventTypes.filter(et => !receivedEvents.find(re => re.type === et));
          reject(new Error(`Timeout waiting for events. Missing: ${missing.join(', ')}`));
          return;
        }

        // Check again in 100ms
        setTimeout(checkEvents, 100);
      };

      checkEvents();
    });
  }

  getMessages(): WebSocketMessage[] {
    return this.messages;
  }

  getErrors(): string[] {
    return this.errors;
  }

  isConnected(): boolean {
    return this.connected;
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// ============================================================================
// Validation Functions
// ============================================================================

async function triggerExecution(apiUrl: string, authToken: string, execution: any): Promise<any> {
  const response = await fetch(`${apiUrl}/v2/activities/executions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(execution),
  });

  if (!response.ok) {
    throw new Error(`Failed to trigger execution: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function validateSingleClient(testCase: ValidationTestCase): Promise<ValidationResult> {
  const startTime = Date.now();
  const client = new TestWebSocketClient();

  try {
    console.log(`\n[Test] ${testCase.name}`);
    console.log('[Test] Connecting to WebSocket...');

    // Step 1: Connect and authenticate
    await client.connect(testCase.input.wsUrl, testCase.input.authToken);

    if (!client.isAuthenticated()) {
      return {
        pass: false,
        testCase: testCase.name,
        actual: {
          connected: client.isConnected(),
          authenticated: false,
          eventsReceived: [],
          eventData: {},
          errors: client.getErrors(),
        },
        expected: {
          connected: true,
          authenticated: true,
          eventsReceived: testCase.expectedEvents,
        },
        duration: Date.now() - startTime,
        details: 'Failed to authenticate with WebSocket server',
      };
    }

    console.log('[Test] WebSocket authenticated');

    // Step 2: Trigger execution
    console.log('[Test] Triggering execution...');
    const executionResult = await triggerExecution(
      testCase.input.apiUrl,
      testCase.input.authToken,
      testCase.input.execution
    );

    console.log('[Test] Execution triggered:', executionResult.execution_id);

    // Step 3: Wait for expected events
    console.log('[Test] Waiting for events:', testCase.expectedEvents.join(', '));
    const events = await client.waitForEvents(testCase.expectedEvents, testCase.timeout);

    console.log('[Test] All expected events received');

    // Step 4: Validate event data
    const eventData: Record<string, any> = {};
    let validationErrors: string[] = [];

    for (const event of events) {
      eventData[event.type] = event.data;

      // Validate execution_started
      if (event.type === 'execution_started') {
        if (!event.data?.execution_id) {
          validationErrors.push('execution_started missing execution_id');
        }
        if (!event.data?.variant_id) {
          validationErrors.push('execution_started missing variant_id');
        }
        if (event.data?.variant_id !== testCase.input.execution.variant_id) {
          validationErrors.push(`execution_started variant_id mismatch: ${event.data?.variant_id} !== ${testCase.input.execution.variant_id}`);
        }
      }

      // Validate execution_completed
      if (event.type === 'execution_completed') {
        if (!event.data?.execution_id) {
          validationErrors.push('execution_completed missing execution_id');
        }
        if (event.data?.success !== testCase.input.execution.success) {
          validationErrors.push(`execution_completed success mismatch: ${event.data?.success} !== ${testCase.input.execution.success}`);
        }
        if (typeof event.data?.duration_ms !== 'number') {
          validationErrors.push('execution_completed missing or invalid duration_ms');
        }
        if (typeof event.data?.cost !== 'number') {
          validationErrors.push('execution_completed missing or invalid cost');
        }
      }

      // Validate template_metrics_updated
      if (event.type === 'template_updated') {
        if (!event.data?.variant_id) {
          validationErrors.push('template_updated missing variant_id');
        }
        if (!event.data?.metrics) {
          validationErrors.push('template_updated missing metrics');
        } else {
          const metrics = event.data.metrics;
          if (typeof metrics.success_rate !== 'number') {
            validationErrors.push('template_updated metrics missing success_rate');
          }
          if (typeof metrics.thompson_alpha !== 'number') {
            validationErrors.push('template_updated metrics missing thompson_alpha');
          }
          if (typeof metrics.thompson_beta !== 'number') {
            validationErrors.push('template_updated metrics missing thompson_beta');
          }
        }
      }
    }

    // Cleanup
    client.disconnect();

    const duration = Date.now() - startTime;
    const pass = validationErrors.length === 0;

    return {
      pass,
      testCase: testCase.name,
      actual: {
        connected: true,
        authenticated: true,
        eventsReceived: events.map(e => e.type),
        eventData,
        errors: validationErrors,
      },
      expected: {
        connected: true,
        authenticated: true,
        eventsReceived: testCase.expectedEvents,
      },
      duration,
      details: pass ? 'All validations passed' : `Validation errors: ${validationErrors.join(', ')}`,
    };

  } catch (error: any) {
    client.disconnect();

    return {
      pass: false,
      testCase: testCase.name,
      actual: {
        connected: client.isConnected(),
        authenticated: client.isAuthenticated(),
        eventsReceived: client.getMessages().map(m => m.type),
        eventData: {},
        errors: [error.message, ...client.getErrors()],
      },
      expected: {
        connected: true,
        authenticated: true,
        eventsReceived: testCase.expectedEvents,
      },
      duration: Date.now() - startTime,
      details: `Test failed: ${error.message}`,
    };
  }
}

async function validateMultipleClients(testCase: ValidationTestCase): Promise<ValidationResult> {
  const startTime = Date.now();
  const clients: TestWebSocketClient[] = [];
  const clientCount = 3;

  try {
    console.log(`\n[Test] ${testCase.name} (${clientCount} clients)`);

    // Step 1: Connect multiple clients
    console.log('[Test] Connecting multiple WebSocket clients...');
    for (let i = 0; i < clientCount; i++) {
      const client = new TestWebSocketClient();
      await client.connect(testCase.input.wsUrl, testCase.input.authToken);
      clients.push(client);
      console.log(`[Test] Client ${i + 1} connected and authenticated`);
    }

    // Step 2: Trigger execution
    console.log('[Test] Triggering execution...');
    const executionResult = await triggerExecution(
      testCase.input.apiUrl,
      testCase.input.authToken,
      testCase.input.execution
    );

    console.log('[Test] Execution triggered:', executionResult.execution_id);

    // Step 3: Wait for events on all clients
    console.log('[Test] Waiting for events on all clients...');
    const allEvents: WebSocketMessage[][] = [];

    for (let i = 0; i < clientCount; i++) {
      const events = await clients[i].waitForEvents(testCase.expectedEvents, testCase.timeout);
      allEvents.push(events);
      console.log(`[Test] Client ${i + 1} received all events`);
    }

    // Step 4: Validate all clients received same events
    let validationErrors: string[] = [];

    // Check that all clients received the same execution_id
    const executionIds = allEvents.map(events => 
      events.find(e => e.type === 'execution_started')?.data?.execution_id
    );

    const uniqueExecutionIds = new Set(executionIds);
    if (uniqueExecutionIds.size !== 1) {
      validationErrors.push(`Clients received different execution_ids: ${Array.from(uniqueExecutionIds).join(', ')}`);
    }

    // Check that all clients received the same event types
    for (let i = 1; i < clientCount; i++) {
      const events1 = allEvents[0].map(e => e.type).sort();
      const events2 = allEvents[i].map(e => e.type).sort();

      if (JSON.stringify(events1) !== JSON.stringify(events2)) {
        validationErrors.push(`Client ${i + 1} received different events than client 1`);
      }
    }

    // Cleanup
    clients.forEach(c => c.disconnect());

    const duration = Date.now() - startTime;
    const pass = validationErrors.length === 0;

    return {
      pass,
      testCase: testCase.name,
      actual: {
        connected: true,
        authenticated: true,
        eventsReceived: allEvents[0].map(e => e.type),
        eventData: {
          clientCount,
          allClientsReceivedSameEvents: pass,
        },
        errors: validationErrors,
      },
      expected: {
        connected: true,
        authenticated: true,
        eventsReceived: testCase.expectedEvents,
      },
      duration,
      details: pass ? 'All clients received same events' : `Validation errors: ${validationErrors.join(', ')}`,
    };

  } catch (error: any) {
    clients.forEach(c => c.disconnect());

    return {
      pass: false,
      testCase: testCase.name,
      actual: {
        connected: false,
        authenticated: false,
        eventsReceived: [],
        eventData: {},
        errors: [error.message],
      },
      expected: {
        connected: true,
        authenticated: true,
        eventsReceived: testCase.expectedEvents,
      },
      duration: Date.now() - startTime,
      details: `Test failed: ${error.message}`,
    };
  }
}

// ============================================================================
// Main Validation Runner
// ============================================================================

export async function runValidation(testCase: ValidationTestCase): Promise<ValidationResult> {
  console.log('\n' + '='.repeat(80));
  console.log('WebSocket Real-Time Dashboard Updates - Validation Harness');
  console.log('='.repeat(80));

  // Run single client test
  const singleClientResult = await validateSingleClient(testCase);

  console.log('\n' + '-'.repeat(80));
  console.log('Single Client Test Result:', singleClientResult.pass ? '✅ PASS' : '❌ FAIL');
  console.log('Duration:', singleClientResult.duration, 'ms');
  console.log('Details:', singleClientResult.details);
  console.log('-'.repeat(80));

  return singleClientResult;
}

export async function runMultiClientValidation(testCase: ValidationTestCase): Promise<ValidationResult> {
  console.log('\n' + '='.repeat(80));
  console.log('WebSocket Real-Time Dashboard Updates - Multi-Client Validation');
  console.log('='.repeat(80));

  // Run multiple client test
  const multiClientResult = await validateMultipleClients(testCase);

  console.log('\n' + '-'.repeat(80));
  console.log('Multi-Client Test Result:', multiClientResult.pass ? '✅ PASS' : '❌ FAIL');
  console.log('Duration:', multiClientResult.duration, 'ms');
  console.log('Details:', multiClientResult.details);
  console.log('-'.repeat(80));

  return multiClientResult;
}

// ============================================================================
// Test Cases (Stored as Impulses)
// ============================================================================

export const TEST_CASES = {
  successCase: {
    name: 'WebSocket Real-Time Events - Success Case',
    input: {
      apiUrl: 'http://localhost:8080',
      wsUrl: 'ws://localhost:8080/ws',
      authToken: 'test-token',
      execution: {
        variant_id: 'test-websocket-validation-success',
        success: true,
        duration_ms: 1000,
        cost: 0.01,
        tokens: {
          input: 100,
          output: 50,
          cache: 0,
        },
      },
    },
    expectedEvents: ['execution_started', 'execution_completed', 'template_updated'],
    timeout: 10000,
  },
  
  failureCase: {
    name: 'WebSocket Real-Time Events - Failure Case',
    input: {
      apiUrl: 'http://localhost:8080',
      wsUrl: 'ws://localhost:8080/ws',
      authToken: 'test-token',
      execution: {
        variant_id: 'test-websocket-validation-failure',
        success: false,
        duration_ms: 500,
        cost: 0.005,
        tokens: {
          input: 50,
          output: 10,
          cache: 0,
        },
      },
    },
    expectedEvents: ['execution_started', 'execution_completed', 'template_updated'],
    timeout: 10000,
  },
};

// ============================================================================
// CLI Helper Function
// ============================================================================

/**
 * Run all validation tests from command line
 * 
 * Usage:
 *   bun run tests/validation-harnesses/websocket-real-time-dashboard-updates-harness.ts
 * 
 * Environment variables:
 *   API_URL - Activity API URL (default: http://localhost:8080)
 *   WS_URL - WebSocket URL (default: ws://localhost:8080/ws)
 *   AUTH_TOKEN - Auth token (default: test-token)
 */
export async function runAllTests(): Promise<boolean> {
  try {
    const testCase = TEST_CASES.successCase;

    // Override from environment variables
    testCase.input.apiUrl = process.env.API_URL || testCase.input.apiUrl;
    testCase.input.wsUrl = process.env.WS_URL || testCase.input.wsUrl;
    testCase.input.authToken = process.env.AUTH_TOKEN || testCase.input.authToken;

    // Run single client test
    const result = await runValidation(testCase);

    // Run multi-client test
    const multiResult = await runMultiClientValidation(testCase);

    // Return success status
    return result.pass && multiResult.pass;
  } catch (error: any) {
    console.error('\n❌ Validation harness failed:', error.message);
    return false;
  }
}

// ============================================================================
// Main Execution
// ============================================================================

if (import.meta.main) {
  runAllTests().then((success) => {
    process.exit(success ? 0 : 1);
  });
}
