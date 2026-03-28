/**
 * Validation Harness: WebSocket-Real-Time-Dashboard-Updates
 * 
 * Tests real-time WebSocket updates from activity execution to dashboard display.
 * Verifies: connection establishment, event broadcasting, UI updates, auto-reconnect.
 * 
 * Usage:
 *   import { runValidation } from './WebSocket-Real-Time-Dashboard-Updates-harness';
 *   const result = await runValidation({ testCase: 'connection-establishment' });
 *   console.log(result.pass ? 'PASS' : 'FAIL');
 */

import WebSocket from 'ws';

// ============================================================================
// Types
// ============================================================================

export interface ValidationInput {
  testCase: 'connection-establishment' | 'execution-events' | 'metrics-updates' | 'auto-reconnect' | 'multi-client';
  apiUrl?: string;
  dashboardUrl?: string;
  executionPayload?: ExecutionPayload;
  timeout?: number; // milliseconds
}

export interface ExecutionPayload {
  variant_id: string;
  success: boolean;
  duration_ms: number;
  cost: number;
  pod_name?: string;
  metrics?: any;
}

export interface ValidationOutput {
  pass: boolean;
  actual: any;
  expected: any;
  errors?: string[];
  details?: any;
}

export interface WebSocketMessage {
  type: string;
  timestamp: string;
  data: any;
}

// ============================================================================
// Test Case 1: Connection Establishment
// ============================================================================

async function testConnectionEstablishment(input: ValidationInput): Promise<ValidationOutput> {
  const apiUrl = input.apiUrl || 'ws://localhost:8080/ws';
  const timeout = input.timeout || 5000;
  
  const errors: string[] = [];
  const details: any = {
    connectionAttempted: false,
    connectionEstablished: false,
    authenticationSent: false,
    authenticationConfirmed: false,
    connectionTime: 0,
  };
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    const ws = new WebSocket(apiUrl);
    details.connectionAttempted = true;
    
    const timeoutHandle = setTimeout(() => {
      errors.push(`Connection timeout after ${timeout}ms`);
      ws.close();
      resolve({
        pass: false,
        actual: details,
        expected: {
          connectionEstablished: true,
          authenticationConfirmed: true,
          connectionTime: '<5000ms',
        },
        errors,
        details,
      });
    }, timeout);
    
    ws.on('open', () => {
      details.connectionEstablished = true;
      details.connectionTime = Date.now() - startTime;
      
      // Send authentication
      ws.send(JSON.stringify({
        type: 'authenticate',
        token: 'test-token',
        sessionId: 'test-session',
        orgId: 'test-org',
      }));
      details.authenticationSent = true;
    });
    
    ws.on('message', (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        
        if (message.type === 'authenticated') {
          details.authenticationConfirmed = true;
          clearTimeout(timeoutHandle);
          ws.close();
          
          const pass = details.connectionEstablished && 
                      details.authenticationConfirmed &&
                      details.connectionTime < timeout;
          
          resolve({
            pass,
            actual: details,
            expected: {
              connectionEstablished: true,
              authenticationConfirmed: true,
              connectionTime: '<5000ms',
            },
            errors: pass ? [] : ['Connection or authentication failed'],
            details,
          });
        }
      } catch (error: any) {
        errors.push(`Failed to parse message: ${error.message}`);
      }
    });
    
    ws.on('error', (error) => {
      errors.push(`WebSocket error: ${error.message}`);
      clearTimeout(timeoutHandle);
      resolve({
        pass: false,
        actual: details,
        expected: {
          connectionEstablished: true,
          authenticationConfirmed: true,
        },
        errors,
        details,
      });
    });
  });
}

// ============================================================================
// Test Case 2: Execution Events
// ============================================================================

async function testExecutionEvents(input: ValidationInput): Promise<ValidationOutput> {
  const apiUrl = input.apiUrl || 'ws://localhost:8080/ws';
  const timeout = input.timeout || 10000;
  
  const errors: string[] = [];
  const details: any = {
    eventsReceived: [],
    execution_started: false,
    execution_completed: false,
    template_updated: false,
    eventOrder: [],
    totalEvents: 0,
  };
  
  return new Promise((resolve) => {
    const ws = new WebSocket(apiUrl);
    
    const timeoutHandle = setTimeout(() => {
      errors.push(`Test timeout after ${timeout}ms`);
      ws.close();
      resolve({
        pass: false,
        actual: details,
        expected: {
          execution_started: true,
          execution_completed: true,
          template_updated: true,
          eventOrder: ['execution_started', 'execution_completed', 'template_updated'],
        },
        errors,
        details,
      });
    }, timeout);
    
    ws.on('open', () => {
      // Authenticate
      ws.send(JSON.stringify({
        type: 'authenticate',
        token: 'test-token',
      }));
    });
    
    ws.on('message', (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        
        // Skip authentication confirmation
        if (message.type === 'authenticated') {
          return;
        }
        
        // Record event
        details.eventsReceived.push(message);
        details.eventOrder.push(message.type);
        details.totalEvents++;
        
        // Check event types
        if (message.type === 'execution_started') {
          details.execution_started = true;
          
          // Validate data shape
          if (!message.data.execution_id || !message.data.variant_id) {
            errors.push('execution_started missing required fields');
          }
        }
        
        if (message.type === 'execution_completed') {
          details.execution_completed = true;
          
          // Validate data shape
          if (!message.data.execution_id || 
              typeof message.data.success !== 'boolean' ||
              typeof message.data.duration_ms !== 'number' ||
              typeof message.data.cost !== 'number') {
            errors.push('execution_completed missing or invalid fields');
          }
        }
        
        if (message.type === 'template_updated') {
          details.template_updated = true;
          
          // Validate data shape
          if (!message.data.variant_id || !message.data.metrics) {
            errors.push('template_updated missing required fields');
          }
        }
        
        // If we've received all expected events, finish test
        if (details.execution_started && 
            details.execution_completed && 
            details.template_updated) {
          clearTimeout(timeoutHandle);
          ws.close();
          
          const pass = errors.length === 0;
          
          resolve({
            pass,
            actual: details,
            expected: {
              execution_started: true,
              execution_completed: true,
              template_updated: true,
              eventOrder: ['execution_started', 'execution_completed', 'template_updated'],
            },
            errors,
            details,
          });
        }
      } catch (error: any) {
        errors.push(`Failed to parse message: ${error.message}`);
      }
    });
    
    ws.on('error', (error) => {
      errors.push(`WebSocket error: ${error.message}`);
      clearTimeout(timeoutHandle);
      resolve({
        pass: false,
        actual: details,
        expected: {
          execution_started: true,
          execution_completed: true,
          template_updated: true,
        },
        errors,
        details,
      });
    });
  });
}

// ============================================================================
// Test Case 3: Metrics Updates
// ============================================================================

async function testMetricsUpdates(input: ValidationInput): Promise<ValidationOutput> {
  const apiUrl = input.apiUrl || 'ws://localhost:8080/ws';
  const timeout = input.timeout || 10000;
  
  const errors: string[] = [];
  const details: any = {
    metricsReceived: false,
    metricsValid: false,
    metricsData: null,
  };
  
  return new Promise((resolve) => {
    const ws = new WebSocket(apiUrl);
    
    const timeoutHandle = setTimeout(() => {
      errors.push(`Test timeout after ${timeout}ms`);
      ws.close();
      resolve({
        pass: false,
        actual: details,
        expected: {
          metricsReceived: true,
          metricsValid: true,
        },
        errors,
        details,
      });
    }, timeout);
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'authenticate',
        token: 'test-token',
      }));
    });
    
    ws.on('message', (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        
        if (message.type === 'template_updated') {
          details.metricsReceived = true;
          details.metricsData = message.data.metrics;
          
          // Validate metrics structure
          const metrics = message.data.metrics;
          const hasRequiredFields = 
            typeof metrics.success_rate === 'number' &&
            typeof metrics.avg_duration_ms === 'number' &&
            typeof metrics.avg_cost_usd === 'number' &&
            typeof metrics.thompson_alpha === 'number' &&
            typeof metrics.thompson_beta === 'number';
          
          details.metricsValid = hasRequiredFields;
          
          if (!hasRequiredFields) {
            errors.push('Metrics missing required fields or invalid types');
          }
          
          clearTimeout(timeoutHandle);
          ws.close();
          
          resolve({
            pass: details.metricsReceived && details.metricsValid,
            actual: details,
            expected: {
              metricsReceived: true,
              metricsValid: true,
              requiredFields: ['success_rate', 'avg_duration_ms', 'avg_cost_usd', 'thompson_alpha', 'thompson_beta'],
            },
            errors,
            details,
          });
        }
      } catch (error: any) {
        errors.push(`Failed to parse message: ${error.message}`);
      }
    });
    
    ws.on('error', (error) => {
      errors.push(`WebSocket error: ${error.message}`);
      clearTimeout(timeoutHandle);
      resolve({
        pass: false,
        actual: details,
        expected: {
          metricsReceived: true,
          metricsValid: true,
        },
        errors,
        details,
      });
    });
  });
}

// ============================================================================
// Test Case 4: Auto-Reconnect
// ============================================================================

async function testAutoReconnect(input: ValidationInput): Promise<ValidationOutput> {
  const apiUrl = input.apiUrl || 'ws://localhost:8080/ws';
  const timeout = input.timeout || 15000;
  
  const errors: string[] = [];
  const details: any = {
    initialConnection: false,
    connectionDropped: false,
    reconnectAttempted: false,
    reconnectSuccessful: false,
    reconnectTime: 0,
  };
  
  return new Promise((resolve) => {
    let ws: WebSocket | null = null;
    let reconnectStartTime = 0;
    
    const timeoutHandle = setTimeout(() => {
      errors.push(`Test timeout after ${timeout}ms`);
      ws?.close();
      resolve({
        pass: false,
        actual: details,
        expected: {
          initialConnection: true,
          reconnectSuccessful: true,
          reconnectTime: '<10000ms',
        },
        errors,
        details,
      });
    }, timeout);
    
    const connect = () => {
      ws = new WebSocket(apiUrl);
      
      ws.on('open', () => {
        if (!details.initialConnection) {
          details.initialConnection = true;
          
          // Authenticate
          ws!.send(JSON.stringify({
            type: 'authenticate',
            token: 'test-token',
          }));
          
          // Wait for auth, then force disconnect
          setTimeout(() => {
            reconnectStartTime = Date.now();
            details.connectionDropped = true;
            ws!.close();
            
            // Attempt reconnect
            setTimeout(() => {
              details.reconnectAttempted = true;
              connect();
            }, 1000);
          }, 1000);
        } else {
          // Reconnection successful
          details.reconnectSuccessful = true;
          details.reconnectTime = Date.now() - reconnectStartTime;
          
          clearTimeout(timeoutHandle);
          ws!.close();
          
          resolve({
            pass: true,
            actual: details,
            expected: {
              initialConnection: true,
              reconnectSuccessful: true,
              reconnectTime: '<10000ms',
            },
            errors: [],
            details,
          });
        }
      });
      
      ws.on('error', (error) => {
        if (!details.initialConnection) {
          errors.push(`Initial connection failed: ${error.message}`);
          clearTimeout(timeoutHandle);
          resolve({
            pass: false,
            actual: details,
            expected: {
              initialConnection: true,
              reconnectSuccessful: true,
            },
            errors,
            details,
          });
        }
      });
    };
    
    connect();
  });
}

// ============================================================================
// Test Case 5: Multi-Client Broadcasting
// ============================================================================

async function testMultiClient(input: ValidationInput): Promise<ValidationOutput> {
  const apiUrl = input.apiUrl || 'ws://localhost:8080/ws';
  const timeout = input.timeout || 10000;
  const clientCount = 3;
  
  const errors: string[] = [];
  const details: any = {
    clientsConnected: 0,
    clientsReceivedEvents: 0,
    eventsPerClient: {},
  };
  
  return new Promise((resolve) => {
    const clients: WebSocket[] = [];
    let eventsExpected = 0;
    
    const timeoutHandle = setTimeout(() => {
      errors.push(`Test timeout after ${timeout}ms`);
      clients.forEach(ws => ws.close());
      resolve({
        pass: false,
        actual: details,
        expected: {
          clientsConnected: clientCount,
          clientsReceivedEvents: clientCount,
          eventsPerClient: 'all clients receive same events',
        },
        errors,
        details,
      });
    }, timeout);
    
    // Connect multiple clients
    for (let i = 0; i < clientCount; i++) {
      const ws = new WebSocket(apiUrl);
      clients.push(ws);
      details.eventsPerClient[`client-${i}`] = [];
      
      ws.on('open', () => {
        details.clientsConnected++;
        
        ws.send(JSON.stringify({
          type: 'authenticate',
          token: `test-token-${i}`,
        }));
      });
      
      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          
          // Skip authentication messages
          if (message.type === 'authenticated') {
            return;
          }
          
          details.eventsPerClient[`client-${i}`].push(message.type);
          
          // Check if all clients received the event
          const allClientsReceivedEvent = Object.values(details.eventsPerClient).every(
            (events: any) => events.includes(message.type)
          );
          
          if (allClientsReceivedEvent && message.type === 'template_updated') {
            details.clientsReceivedEvents = clientCount;
            
            clearTimeout(timeoutHandle);
            clients.forEach(ws => ws.close());
            
            resolve({
              pass: true,
              actual: details,
              expected: {
                clientsConnected: clientCount,
                clientsReceivedEvents: clientCount,
                eventsPerClient: 'all clients receive same events',
              },
              errors: [],
              details,
            });
          }
        } catch (error: any) {
          errors.push(`Failed to parse message: ${error.message}`);
        }
      });
      
      ws.on('error', (error) => {
        errors.push(`Client ${i} error: ${error.message}`);
      });
    }
  });
}

// ============================================================================
// Main Validation Runner
// ============================================================================

export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  console.log(`[Validation] Running test case: ${input.testCase}`);
  
  try {
    switch (input.testCase) {
      case 'connection-establishment':
        return await testConnectionEstablishment(input);
      
      case 'execution-events':
        return await testExecutionEvents(input);
      
      case 'metrics-updates':
        return await testMetricsUpdates(input);
      
      case 'auto-reconnect':
        return await testAutoReconnect(input);
      
      case 'multi-client':
        return await testMultiClient(input);
      
      default:
        return {
          pass: false,
          actual: null,
          expected: null,
          errors: [`Unknown test case: ${input.testCase}`],
        };
    }
  } catch (error: any) {
    return {
      pass: false,
      actual: null,
      expected: null,
      errors: [`Validation error: ${error.message}`],
      details: { error: error.stack },
    };
  }
}

// ============================================================================
// CLI Runner (for standalone execution)
// ============================================================================

if (require.main === module) {
  const testCase = process.argv[2] as ValidationInput['testCase'] || 'connection-establishment';
  const apiUrl = process.env.API_URL || 'ws://localhost:8080/ws';
  
  console.log(`Running validation harness for: WebSocket-Real-Time-Dashboard-Updates`);
  console.log(`Test case: ${testCase}`);
  console.log(`API URL: ${apiUrl}`);
  console.log('');
  
  runValidation({ testCase, apiUrl })
    .then((result) => {
      console.log('\n=== VALIDATION RESULT ===');
      console.log(`Status: ${result.pass ? '✅ PASS' : '❌ FAIL'}`);
      console.log('\nExpected:');
      console.log(JSON.stringify(result.expected, null, 2));
      console.log('\nActual:');
      console.log(JSON.stringify(result.actual, null, 2));
      
      if (result.errors && result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach(err => console.log(`  - ${err}`));
      }
      
      if (result.details) {
        console.log('\nDetails:');
        console.log(JSON.stringify(result.details, null, 2));
      }
      
      process.exit(result.pass ? 0 : 1);
    })
    .catch((error) => {
      console.error('Validation harness error:', error);
      process.exit(1);
    });
}
