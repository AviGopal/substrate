#!/usr/bin/env node
/**
 * Test WebSocket Client for Activity API
 * Tests real-time updates from activity executions
 */

const WebSocket = require('ws');

const WS_URL = 'ws://api.minibob.local/ws';

console.log(`\n🔌 Connecting to WebSocket: ${WS_URL}\n`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ WebSocket connected successfully!');
  console.log('📡 Listening for activity execution events...\n');
  
  // Send authentication if needed
  ws.send(JSON.stringify({
    type: 'authenticate',
    token: 'test-token'
  }));
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📨 Received message:');
    console.log(JSON.stringify(message, null, 2));
    console.log('');
    
    // Log specific event types
    if (message.type === 'execution_started') {
      console.log('🚀 Execution started:', message.data.execution_id);
    } else if (message.type === 'execution_completed') {
      console.log('✅ Execution completed:', message.data.execution_id, 
                  '| Success:', message.data.success,
                  '| Duration:', message.data.duration_ms + 'ms',
                  '| Cost: $' + message.data.cost);
    } else if (message.type === 'template_updated') {
      console.log('📊 Template metrics updated:', message.data.variant_id);
    } else if (message.type === 'authenticated') {
      console.log('🔐 Authentication successful');
    }
  } catch (error) {
    console.error('❌ Failed to parse message:', error.message);
    console.log('Raw data:', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`\n🔌 WebSocket disconnected (code: ${code}, reason: ${reason || 'none'})\n`);
  process.exit(0);
});

// Keep alive
console.log('Press Ctrl+C to disconnect\n');
console.log('Now trigger an execution with:');
console.log('  curl -X POST http://api.minibob.local/v2/activities/executions \\');
console.log('    -H "Content-Type: application/json" \\');
console.log('    -d \'{"execution_id":"test-123","variant_id":"rebuild-and-deploy-with-helmfile::5ed2bff521d1e68f","success":true,"duration_ms":5000,"cost":0.01,"tokens":{"input":1000,"output":500,"cache":200},"pod_name":"test"}\'\n');
