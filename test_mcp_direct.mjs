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
          console.log('✓ Initialized');
          // Call search_activities tool
          server.stdin.write(JSON.stringify({
            jsonrpc: '2.0', id: 2, method: 'tools/call',
            params: { name: 'search_activities', arguments: { query: '', limit: 5 } }
          }) + '\n');
        }
        if (msg.id === 2) {
          if (msg.result) {
            const text = msg.result.content?.[0]?.text;
            if (text) {
              const data = JSON.parse(text);
              console.log(`✓ SUCCESS: ${data.count} activities returned`);
              if (data.activities?.length > 0) {
                console.log(`  First: ${data.activities[0].name}`);
              }
            }
          } else if (msg.error) {
            console.log(`✗ Error: ${msg.error.message}`);
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
  console.log('Timeout');
  server.kill();
  process.exit(1);
}, 10000);
