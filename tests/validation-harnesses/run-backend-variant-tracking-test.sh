#!/bin/bash
# Simple test runner for backend-variant-tracking-optimization-architecture-harness

cd "$(dirname "$0")"

echo "Running Backend Variant Tracking Optimization Architecture Validation..."
echo ""

node -e "
const harness = require('./backend-variant-tracking-optimization-architecture-harness.ts');

(async () => {
  const result = await harness.runValidation({
    checkDatabase: false,
    skipMcpReloadTest: true
  });
  
  console.log(result.details.join('\n'));
  console.log('');
  console.log('Result:', result.pass ? 'PASS ✅' : 'FAIL ❌');
  
  process.exit(result.pass ? 0 : 1);
})();
"
