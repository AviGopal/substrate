import { spawn } from 'child_process';

const server = spawn('metabob-cli', ['mcp', '--transport', 'stdio'], {
  env: {
    ...process.env,
    METABOB_API_URL: 'http://localhost:8080',
    METABOB_PROJECT_ID: 'exp-repo-dev',
  },
  stdio: ['pipe', 'pipe', 'ignore']
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
          console.log('[TEST] Initialized - calling test_minimal_tool');
          server.stdin.write(JSON.stringify({
            jsonrpc: '2.0', id: 2, method: 'tools/call',
            params: { name: 'test_minimal_tool', arguments: {} }
          }) + '\n');
        }
        if (msg.id === 2) {
          if (msg.result) {
            console.log('[TEST] Minimal tool responded!');
          } else if (msg.error) {
            console.log('[TEST] Error:', msg.error.message);
          }
          server.kill();
          setTimeout(() => {
            console.log('\n=== Checking logs ===');
            const { execSync } = require('child_process');
            const logs = execSync('tail -50 .metabob/logs/server.log', { encoding: 'utf-8' });
            const lines = logs.split('\n').filter(l => 
              l.includes('TEST_TOOL') || l.includes('test_minimal') || 
              (l.includes('TOOL_START') && l.includes('test_minimal')) ||
              (l.includes('TOOL_COMPLETE') && l.includes('test_minimal'))
            );
            lines.forEach(l => console.log(l));
            process.exit(0);
          }, 500);
        }
      } catch (e) {}
    }
  });
});

server.stdin.write(JSON.stringify({
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
}) + '\n');

setTimeout(() => {
  console.log('[TEST] Timeout!');
  server.kill();
  process.exit(1);
}, 10000);
