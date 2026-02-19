#!/bin/bash
# Debug context negotiation failure

set -e

echo "=== Debugging Context Negotiation ==="
echo ""

# Enable debug logging
export DEBUG="*memory-agent*,*activity*"
export NODE_ENV="development"

cat > /tmp/test-context-debug.mjs << 'EOF'
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BASE_DIR = '/home/avi/documents/work/exp-repo/metabob-devbob';

// Enable debug logging
process.env.DEBUG = '*memory-agent*,*activity*';

async function test() {
  try {
    console.log('\n=== Test 1: Check Memory Agent ===');
    const { Agent } = await import(`${BASE_DIR}/repos/metabob-opencode/packages/opencode/dist/agent/agent.js`);
    const memoryAgent = await Agent.get('memory');
    console.log('Memory agent:', memoryAgent ? 'FOUND' : 'NOT FOUND');
    if (memoryAgent) {
      console.log('  Name:', memoryAgent.name);
      console.log('  Type:', memoryAgent.constructor.name);
    }

    console.log('\n=== Test 2: Check Session Memory Agent Functions ===');
    const { SessionMemoryAgent } = await import(`${BASE_DIR}/repos/metabob-opencode/packages/opencode/dist/session/memory-agent.js`);
    console.log('SessionMemoryAgent.gatherContext:', typeof SessionMemoryAgent.gatherContext);
    console.log('SessionMemoryAgent.analyzeIntent:', typeof SessionMemoryAgent.analyzeIntent);

    console.log('\n=== Test 3: Test Context Gathering (minimal) ===');
    try {
      const result = await SessionMemoryAgent.gatherContext({
        requirements: [{
          key: 'test',
          hint: 'Provide test context',
          impulseTypes: ['memo'],
          required: true,
          budgetRange: [100, 500]
        }],
        reason: 'Testing context gathering',
        recentMessages: []
      });
      console.log('SUCCESS: Context gathered');
      console.log('Result keys:', Object.keys(result));
    } catch (err) {
      console.error('FAILED: Context gathering error');
      console.error('Error:', err.message);
      console.error('Stack:', err.stack);
    }

  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

test().catch(console.error);
EOF

echo "Running diagnostic tests..."
cd /home/avi/documents/work/exp-repo/metabob-devbob
node /tmp/test-context-debug.mjs

echo ""
echo "=== Debug Complete ==="
