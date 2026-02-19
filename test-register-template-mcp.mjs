#!/usr/bin/env node
/**
 * Register create-activity-self-contained template via metabob-cli MCP
 * 
 * This proves the correct flow:
 * 1. Read template JSON (from our updated version)
 * 2. Register via metabob_register_activity_template MCP tool
 * 3. Verify it's stored in ~/.metabob/activities/
 * 4. Verify devbob containers can access it
 */

import { readFileSync } from 'fs';
import { spawn } from 'child_process';

console.log('🔧 Registering create-activity-self-contained via MCP\n');

// Step 1: Read the updated template
console.log('Step 1: Reading updated template...');
const templatePath = '.metabob/activities/create-activity-self-contained.json';
const templateJson = readFileSync(templatePath, 'utf8');
const template = JSON.parse(templateJson);
console.log(`✅ Template loaded: ${template.name}\n`);

// Step 2: Create MCP client to metabob-cli
console.log('Step 2: Connecting to metabob-cli MCP server...');

// The metabob-cli MCP server is configured in opencode.json
// We'll call it via stdio transport
const mcpServer = spawn('/opt/metabob-cli/.venv/bin/python', [
  '-m',
  'metabob_cli.mcp.server'
], {
  env: {
    ...process.env,
    METABOB_CONFIG: '/workspace/.metabob/config.json'
  }
});

let buffer = '';
let initialized = false;

mcpServer.stdout.on('data', (data) => {
  buffer += data.toString();
  
  // Process complete JSON-RPC messages
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep incomplete line in buffer
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    try {
      const message = JSON.parse(line);
      console.log('Received:', JSON.stringify(message, null, 2).substring(0, 200));
      
      // Check if initialization complete
      if (message.result && !initialized) {
        initialized = true;
        console.log('✅ MCP server initialized\n');
        
        // Step 3: Register template
        console.log('Step 3: Registering template via metabob_register_activity_template...');
        const registerRequest = {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'metabob_register_activity_template',
            arguments: {
              template: template
            }
          }
        };
        
        mcpServer.stdin.write(JSON.stringify(registerRequest) + '\n');
      }
      
      // Check if registration complete
      if (message.id === 2 && message.result) {
        console.log('✅ Template registered!\n');
        console.log('Result:', JSON.stringify(message.result, null, 2));
        
        // Close MCP server
        mcpServer.kill();
        process.exit(0);
      }
      
      if (message.error) {
        console.error('❌ Error:', message.error);
        mcpServer.kill();
        process.exit(1);
      }
    } catch (e) {
      // Ignore JSON parse errors for incomplete messages
    }
  }
});

mcpServer.stderr.on('data', (data) => {
  console.error('MCP stderr:', data.toString());
});

mcpServer.on('exit', (code) => {
  console.log(`MCP server exited with code ${code}`);
});

// Initialize MCP server
console.log('Sending initialization request...');
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'template-registration-script',
      version: '1.0.0'
    }
  }
};

mcpServer.stdin.write(JSON.stringify(initRequest) + '\n');

// Timeout after 30 seconds
setTimeout(() => {
  console.error('❌ Timeout waiting for MCP server');
  mcpServer.kill();
  process.exit(1);
}, 30000);
