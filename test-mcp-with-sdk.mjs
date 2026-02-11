#!/usr/bin/env node
/**
 * Test MCP using the actual MCP SDK (same as OpenCode uses)
 */
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

async function test() {
  console.log('Creating MCP client...');
  
  const transport = new StdioClientTransport({
    command: 'metabob-cli',
    args: ['mcp', '--transport', 'stdio'],
    env: {
      ...process.env,
      METABOB_API_KEY: 'test-api-key',
      METABOB_API_URL: 'http://localhost:8080',
      METABOB_PROJECT_ID: 'metabob-devbob',
      METABOB_ORG_ID: 'test-org',
    }
  });
  
  const client = new Client({
    name: 'test-client',
    version: '1.0.0',
  }, {
    capabilities: {}
  });
  
  await client.connect(transport);
  console.log('Connected!');
  
  // List tools
  console.log('\nListing tools...');
  const toolsResult = await client.listTools();
  console.log(`Found ${toolsResult.tools.length} tools`);
  
  const searchTool = toolsResult.tools.find(t => t.name === 'search_activities');
  if (searchTool) {
    console.log('✓ search_activities found');
    
    // Call it
    console.log('\nCalling search_activities...');
    const result = await client.callTool({
      name: 'search_activities',
      arguments: {
        query: '',
        category: '',
        limit: 5,
        min_success_rate: 0.0
      }
    });
    
    console.log('Result:', JSON.stringify(result, null, 2).substring(0, 500));
  } else {
    console.log('✗ search_activities NOT found');
    console.log('Available:', toolsResult.tools.map(t => t.name).slice(0, 5));
  }
  
  await client.close();
}

test().catch(console.error);
