#!/bin/bash
# Validation runner for metabob-cli-to-dashboard-complete-data-flow
# Loads credentials and executes TypeScript harness

set -e

CREDS_FILE="/tmp/e2e-test-creds.sh"
API_BASE_URL="${API_BASE_URL:-http://app.metabob.local}"

# Check if credentials exist
if [ ! -f "$CREDS_FILE" ]; then
    echo "❌ Credentials file not found: $CREDS_FILE"
    echo "Run authentication flow first to generate credentials"
    exit 1
fi

# Source credentials
source "$CREDS_FILE"

# Verify required variables
if [ -z "$JWT_TOKEN" ] || [ -z "$ORG_ID" ]; then
    echo "❌ Missing required credentials: JWT_TOKEN or ORG_ID"
    exit 1
fi

echo "🚀 Running validation harness: metabob-cli-to-dashboard-complete-data-flow"
echo "   API Base URL: $API_BASE_URL"
echo "   Organization ID: $ORG_ID"
echo ""

# Export for TypeScript
export API_BASE_URL
export JWT_TOKEN
export ORG_ID

# Run TypeScript harness
cd "$(dirname "$0")"
npx ts-node metabob-cli-to-dashboard-complete-data-flow-harness.ts

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ Validation PASSED"
else
    echo ""
    echo "❌ Validation FAILED"
fi

exit $EXIT_CODE
