import { spawn } from 'child_process';

const server = spawn('metabob-cli', ['mcp', '--transport', 'stdio'], {
  env: {
    ...process.env,
    METABOB_API_URL: 'http://localhost:8080',
    METABOB_PROJECT_ID: 'exp-repo-dev',
  },
  stdio: ['pipe', 'pipe', 'pipe']
});

let buffer = '';
let initialized = false;

server.stderr.on('data', (data) => {
  const text = data.toString();
  if (text.includes('TOOL_START') || text.includes('TOOL_COMPLETE')) {
    console.log('[SERVER]', text.trim().split('\n')[0]);
  }
});

server.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  lines.forEach(line => {
    if (line.trim()) {
      try {
        const msg = JSON.parse(line);
        if (msg.id === 1 && msg.result && !initialized) {
          initialized = true;
          console.log('✓ Initialized - calling search_activities...');
          server.stdin.write(JSON.stringify({
            jsonrpc: '2.0', id: 2, method: 'tools/call',
            params: { name: 'search_activities', arguments: { query: '', limit: 5, category: null, min_success_rate: 0.0 } }
          }) + '\n');
        }
        if (msg.id === 2) {
          if (msg.result) {
            const text = msg.result.content?.[0]?.text || '';
            console.log('\n✓ Response received:');
            console.log(text.substring(0, 300));
            const data = JSON.parse(text);
            console.log(`\n✓ ${data.status}: ${data.count} activities`);
            if (data.activities?.length > 0) {
              console.log(`✓ First activity: ${data.activities[0].name} (${data.activities[0].id})`);
            }
          } else if (msg.error) {
            console.log(`\n✗ Error: ${msg.error.message}`);
          }
          server.kill();
          process.exit(0);
        }
      } catch (e) {
        console.error('Parse error:', e.message);
      }
    }
  });
});

server.stdin.write(JSON.stringify({
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
}) + '\n');

setTimeout(() => {
  console.log('\n✗ Timeout after 10s');
  server.kill();
  process.exit(1);
}, 10000);
