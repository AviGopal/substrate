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
          // Call listTools
          server.stdin.write(JSON.stringify({
            jsonrpc: '2.0', id: 2, method: 'tools/list', params: {}
          }) + '\n');
        }
        if (msg.id === 2 && msg.result) {
          console.log(`✓ Tools: ${msg.result.tools.length}`);
          const activityTools = msg.result.tools.filter(t => t.name.includes('activity') || t.name.includes('search'));
          console.log('\nActivity/Search tools:');
          activityTools.forEach(t => console.log(`  - ${t.name}`));
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

setTimeout(() => { server.kill(); process.exit(1); }, 10000);
