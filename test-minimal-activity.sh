#!/bin/bash
# Test minimal activity without context requirements

set -e

echo "=== Testing Minimal Activity (No Context Requirements) ==="
echo ""

TEMPLATE_FILE="templates/bootstrap/hello-world-minimal.json"
TEST_ID=$(date +%s)

echo "1. Validating template JSON..."
cat "$TEMPLATE_FILE" | python3 -m json.tool > /dev/null
echo "   ✅ Valid JSON"
echo ""

echo "2. Registering template with backend..."
cd repos/metabob-cli
node -e "
const { register_activity_template } = require('./dist/tools/activity/template-registry.js');
(async () => {
  try {
    const result = await register_activity_template({
      file_path: '../../$TEMPLATE_FILE',
      register_with_metabob: true
    });
    console.log('   ✅ Registered:', result.templateId);
  } catch (err) {
    console.error('   ❌ Registration failed:', err.message);
    process.exit(1);
  }
})();
" || echo "   ⚠️  Registration failed (may already exist)"
cd ../..
echo ""

echo "3. Executing activity via test script..."
cat > /tmp/test-minimal-activity.ts << 'EOF'
import { activity } from './repos/metabob-opencode/packages/opencode/src/tools/activity/activity-tool.js';

(async () => {
  const testId = Date.now().toString();
  console.log('Executing activity with testId:', testId);
  
  try {
    const result = await activity({
      templateId: 'hello-world-minimal',
      variables: {
        testId: testId,
        name: 'Activity System Test'
      },
      reason: 'Testing minimal activity execution without context requirements'
    });
    
    console.log('\n=== RESULT ===');
    console.log('Status:', result.status);
    console.log('Duration:', result.duration, 'ms');
    console.log('Impulses loaded:', Object.keys(result.impulses || {}).length);
    console.log('Tasks executed:', result.prompts?.length || 0);
    console.log('Agents used:', result.agentsUsed?.length || 0);
    
    if (result.status === 'completed') {
      console.log('\n✅ Activity executed successfully!');
      console.log('\nChecking output file...');
      const fs = require('fs');
      const outputPath = `/tmp/hello-${testId}.txt`;
      if (fs.existsSync(outputPath)) {
        const content = fs.readFileSync(outputPath, 'utf-8');
        console.log('Output:', content);
      } else {
        console.log('⚠️  Output file not found at', outputPath);
      }
    } else {
      console.log('\n❌ Activity failed');
      console.log('Error:', result.error);
    }
  } catch (err) {
    console.error('\n❌ Execution error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
EOF

npx tsx /tmp/test-minimal-activity.ts

echo ""
echo "=== Test Complete ==="
