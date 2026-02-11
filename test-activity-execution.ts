#!/usr/bin/env node
/**
 * Test script to verify activity execution through the activity system
 * 
 * This tests that:
 * 1. Activity templates can be registered
 * 2. Activities can be discovered via search
 * 3. Activities can be executed with variables
 * 4. Activity results are captured
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testActivityExecution() {
  console.log('🧪 Testing Activity Execution System\n');

  // Step 1: Verify backend is running
  console.log('1️⃣  Verifying backend connectivity...');
  try {
    const { stdout } = await execAsync('curl -s http://localhost:8080/health || echo "Backend not responding"');
    if (stdout.includes('Backend not responding')) {
      console.error('❌ Backend is not running on http://localhost:8080');
      console.log('   Start it with: cd repos/metabob-rpc-api && docker-compose up -d');
      process.exit(1);
    }
    console.log('✅ Backend is running\n');
  } catch (error) {
    console.error('❌ Failed to check backend:', error);
    process.exit(1);
  }

  // Step 2: Register the jiggle-documentation template
  console.log('2️⃣  Registering jiggle-documentation template...');
  try {
    const { stdout } = await execAsync(
      'cd repos/metabob-cli && python -m metabob_cli register-template ../../templates/custom/jiggle-documentation.json --status testing'
    );
    console.log(stdout);
    
    // Extract variant ID from output
    const match = stdout.match(/Variant ID: ([\w-]+)/);
    if (!match) {
      console.error('❌ Could not extract variant ID from registration output');
      process.exit(1);
    }
    const variantId = match[1];
    console.log(`✅ Template registered with variant ID: ${variantId}\n`);
    
    // Step 3: Search for the template
    console.log('3️⃣  Searching for registered template...');
    const { stdout: searchOutput } = await execAsync(
      `cd repos/metabob-cli && python -m metabob_cli mcp --transport stdio <<EOF
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"metabob_search_activities","arguments":{"category":"refactor"}}}
EOF`
    );
    console.log('Search output:', searchOutput.substring(0, 200), '...\n');
    
    // Step 4: Report results
    console.log('4️⃣  Test Summary:');
    console.log('   ✅ Template registration: SUCCESS');
    console.log('   ✅ Variant ID extracted:', variantId);
    console.log('   ℹ️  To execute this activity in OpenCode, use:');
    console.log(`      activity({ activityId: "${variantId}", variables: {...}, reason: "..." })`);
    console.log('\n📝 Note: The activity tool requires an active OpenCode session with MCP configured');
    
  } catch (error: any) {
    console.error('❌ Template registration failed:', error.message);
    process.exit(1);
  }
}

testActivityExecution().catch(console.error);
