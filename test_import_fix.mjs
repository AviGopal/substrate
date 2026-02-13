import { spawn } from 'child_process';

const start = Date.now();
const server = spawn('metabob-cli', ['mcp', '--transport', 'stdio'], {
  env: {
    ...process.env,
    METABOB_API_URL: 'http://localhost:8080',
    METABOB_PROJECT_ID: 'exp-repo-dev',
  },
  stdio: ['pipe', 'pipe', 'pipe']
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
          console.log(`[${Date.now()-start}ms] Initialized - calling search_activities`);
          server.stdin.write(JSON.stringify({
            jsonrpc: '2.0', id: 2, method: 'tools/call',
            params: { name: 'search_activities', arguments: { query: '', limit: 3 } }
          }) + '\n');
        }
        if (msg.id === 2) {
          const elapsed = Date.now()-start;
          if (msg.result) {
            const text = msg.result.content?.[0]?.text;
            if (text) {
              const data = JSON.parse(text);
              console.log(`[${elapsed}ms] ✓ SUCCESS: ${data.count} activities returned!`);
              if (elapsed < 5000) {
                console.log('✓✓✓ FIX WORKS - Tool responded in < 5 seconds!');
              } else {
                console.log(`⚠ Still slow: ${elapsed}ms`);
              }
            }
          } else if (msg.error) {
            console.log(`[${elapsed}ms] ✗ Error: ${msg.error.message}`);
          }
          server.kill();
          process.exit(0);
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
  console.log(`[${Date.now()-start}ms] TIMEOUT`);
  server.kill();
  process.exit(1);
}, 10000);
