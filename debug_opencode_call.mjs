// Debug: What happens when OpenCode calls search_activities?
// Compare OpenCode's MCP client to our working direct test

import { execSync } from 'child_process';

console.log('=== Debugging OpenCode MCP Client ===\n');

// Check which MCP server OpenCode is connected to
console.log('1. Check running MCP servers:');
try {
  const procs = execSync('ps aux | grep "metabob-cli mcp" | grep -v grep', { encoding: 'utf-8' });
  procs.trim().split('\n').forEach((line, i) => {
    const parts = line.split(/\s+/);
    console.log(`   Server ${i+1}: PID ${parts[1]}, Started: ${parts[8]}`);
  });
} catch (e) {
  console.log('   No servers running');
}

console.log('\n2. Check which OpenCode process we are:');
try {
  const procs = execSync('ps aux | grep "bun run.*opencode" | grep -v grep', { encoding: 'utf-8' });
  procs.trim().split('\n').forEach((line, i) => {
    const parts = line.split(/\s+/);
    console.log(`   OpenCode ${i+1}: PID ${parts[1]}, Started: ${parts[8]}`);
  });
} catch (e) {
  console.log('   No OpenCode running');
}

console.log('\n3. The Problem:');
console.log('   - Direct MCP call: Works (returns 5 activities)');
console.log('   - OpenCode search_activities tool: Returns empty');
console.log('');
console.log('4. Hypothesis:');
console.log('   OpenCode MCP client is either:');
console.log('   a) Not connected to MCP server at all');
console.log('   b) Connected but callMCPTool() returns undefined');
console.log('   c) Connected but catching/suppressing errors');
console.log('');
console.log('5. Next Step:');
console.log('   Check OpenCode logs for MCP connection status');

// Check metabob.ts for error handling
console.log('\n6. Checking error handling in metabob.ts:');
const errorHandling = execSync('grep -A 5 "catch.*error" repos/metabob-opencode/packages/opencode/src/util/metabob.ts | grep -A 3 "searchActivities" | head -10', { encoding: 'utf-8' });
console.log(errorHandling || '   (no output)');

console.log('\n7. Action: Add debug logging to metabob.ts searchActivities()');
