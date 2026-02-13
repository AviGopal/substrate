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
          console.log('✓ Initialized - calling search_activities (omitting category)...');
          // Omit category parameter completely
          server.stdin.write(JSON.stringify({
            jsonrpc: '2.0', id: 2, method: 'tools/call',
            params: { 
              name: 'search_activities', 
              arguments: { 
                query: '', 
                limit: 5,
                min_success_rate: 0.0
                // category intentionally omitted
              } 
            }
          }) + '\n');
        }
        if (msg.id === 2) {
          if (msg.result) {
            const text = msg.result.content?.[0]?.text || '';
            const data = JSON.parse(text);
            console.log(`\n✅ SUCCESS: ${data.status}, ${data.count} activities`);
            if (data.activities?.length > 0) {
              console.log('\nFirst 3:');
              data.activities.slice(0, 3).forEach((a, i) => {
                console.log(`  ${i+1}. ${a.name} (${a.id}) - ${a.task_count} tasks`);
              });
            }
          } else if (msg.error) {
            console.log(`\n✗ Error: ${msg.error.message}`);
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
  console.log('\n✗ Timeout');
  server.kill();
  process.exit(1);
}, 10000);
