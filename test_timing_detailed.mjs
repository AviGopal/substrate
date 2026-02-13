import { spawn } from 'child_process';

const server = spawn('metabob-cli', ['mcp', '--transport', 'stdio'], {
  env: {
    ...process.env,
    METABOB_API_URL: 'http://localhost:8080',
    METABOB_PROJECT_ID: 'exp-repo-dev',
  },
  stdio: ['pipe', 'pipe', 'ignore']  // Ignore stderr to avoid noise
});

let buffer = '';

server.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  lines.forEach(line => {
    if (line.trim()) {
      try {
        const msg = JSON.parse(line);
        if (msg.id === 1 && msg.result) {
          console.log('[CLIENT] Initialize OK - sending search_activities');
          server.stdin.write(JSON.stringify({
            jsonrpc: '2.0', id: 2, method: 'tools/call',
            params: { name: 'search_activities', arguments: { query: '', limit: 3 } }
          }) + '\n');
        }
        if (msg.id === 2) {
          if (msg.result) {
            console.log('[CLIENT] Got result!');
            server.kill();
            setTimeout(() => showTimingAnalysis(), 500);
          } else if (msg.error) {
            console.log('[CLIENT] Got error:', msg.error.message);
            server.kill();
            setTimeout(() => showTimingAnalysis(), 500);
          }
        }
      } catch (e) {}
    }
  });
});

// Send initialize
server.stdin.write(JSON.stringify({
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
}) + '\n');

setTimeout(() => {
  console.log('[CLIENT] Timeout - killing server');
  server.kill();
  setTimeout(() => showTimingAnalysis(), 500);
}, 10000);

function showTimingAnalysis() {
  console.log('\n=== TIMING ANALYSIS ===');
  const { execSync } = require('child_process');
  try {
    const logs = execSync('tail -100 .metabob/logs/server.log', { encoding: 'utf-8' });
    const lines = logs.split('\n').filter(l => 
      l.includes('TIMING') || l.includes('TOOL_START') || l.includes('TOOL_COMPLETE') ||
      l.includes('SERVER started') || l.includes('Starting background') ||
      l.includes('Processing request')
    );
    lines.slice(-20).forEach(l => console.log(l));
  } catch (e) {
    console.log('Could not read logs:', e.message);
  }
  process.exit(0);
}
