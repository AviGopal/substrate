import { readFileSync } from 'fs';
import { execSync } from 'child_process';

console.log('=== OpenCode MCP Client Diagnostic ===\n');

// Check if metabob-cli is running
try {
  const processes = execSync('ps aux | grep "metabob-cli mcp" | grep -v grep', { encoding: 'utf-8' });
  console.log('✓ MCP servers running:');
  processes.trim().split('\n').forEach((line, i) => {
    const parts = line.split(/\s+/);
    console.log(`  ${i+1}. PID ${parts[1]} - Started: ${parts[8]}`);
  });
} catch (e) {
  console.log('✗ No MCP servers running');
}

// Check OpenCode config
console.log('\n✓ OpenCode Config:');
const config = JSON.parse(readFileSync('.opencode/opencode.json', 'utf-8'));
if (config.mcp?.metabob) {
  console.log('  Type:', config.mcp.metabob.type);
  console.log('  Command:', config.mcp.metabob.command.join(' '));
  console.log('  Enabled:', config.mcp.metabob.enabled);
} else {
  console.log('  ✗ No mcp.metabob config found!');
}

console.log('\n--- The Issue ---');
console.log('search_activities returns empty because:');
console.log('  1. MCP tool receives category: null (invalid)');
console.log('  2. Validation error occurs');
console.log('  3. OpenCode catches error and returns []');
console.log('\n--- The Fix ---');
console.log('In metabob.ts searchActivities(), change:');
console.log('  category: options?.category ?? null');
console.log('To:');
console.log('  category: options?.category || undefined');
console.log('(undefined will omit the parameter, null causes validation error)');
