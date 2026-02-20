#!/bin/bash

# Test script to validate impulse loading fix (commit 7465be33)
# 
# This script:
# 1. Registers fix-bug-with-metabob template (has contextRequirements)
# 2. Executes the activity
# 3. Examines activity storage to verify impulses were loaded
#
# Expected results:
# - impulses[key].loaded = true
# - impulses[key].content populated
# - executionEvidence.sessionsSpawned.length > 0

set -e

CONTAINER="devbob-clean"
TEMPLATE_FILE="/opt/repos/metabob-opencode/packages/opencode/templates/opencode-dev/fix-bug-with-metabob.json"

echo "=== Testing Impulse Loading Fix (commit 7465be33) ==="
echo ""

# Step 1: Register template
echo "Step 1: Registering fix-bug-with-metabob template..."
docker exec $CONTAINER bash -c "cat > /tmp/register-template.ts << 'EOF'
import { register_activity_template } from '/opt/repos/metabob-opencode/packages/opencode/src/tool/register-activity-template'

async function main() {
  try {
    const result = await register_activity_template({
      file_path: '$TEMPLATE_FILE',
      register_with_metabob: false, // Local only for testing
    })
    console.log('Template registered:', JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('Registration failed:', error)
    process.exit(1)
  }
}

main()
EOF
bun run /tmp/register-template.ts"

echo ""
echo "Step 2: Executing activity with fix-bug-with-metabob template..."
echo "This will trigger context gathering and impulse loading..."

# We'll use opencode activity command
docker exec -it $CONTAINER bash -c "
cd /opt/repos/metabob-opencode && 
opencode activity \
  --template fix-bug-with-metabob \
  --variables '{\"testMode\": true}' \
  --reason 'Testing impulse loading fix: validate that bugDescription, errorContext impulses are loaded correctly'
"

echo ""
echo "Step 3: Examining activity storage..."
echo "Looking for the most recent activity..."

# Find most recent activity file
ACTIVITY_FILE=$(docker exec $CONTAINER bash -c "ls -t /root/.local/share/opencode/storage/activity/*.json 2>/dev/null | head -1")

if [ -z "$ACTIVITY_FILE" ]; then
  echo "ERROR: No activity found in storage"
  exit 1
fi

echo "Found activity: $ACTIVITY_FILE"
echo ""

# Extract key information
docker exec $CONTAINER bash -c "cat $ACTIVITY_FILE | jq '{
  id: .id,
  status: .status,
  templateId: .templateId,
  impulse_count: (.impulses | length),
  impulses: (.impulses | to_entries | map({
    key: .key,
    loaded: .value.loaded,
    has_content: (.value.content != null and .value.content != \"\"),
    token_count: .value.tokenCount,
    requirement: .value.metadata.requirement
  })),
  sessions_spawned: (.executionEvidence.sessionsSpawned | length),
  tool_calls: (.executionEvidence.toolCalls | length)
}'"

echo ""
echo "=== Validation Criteria ==="
echo "✓ impulses should have loaded=true"
echo "✓ impulses should have content (not empty)"
echo "✓ executionEvidence.sessionsSpawned should be > 0"
echo "✓ Status should be 'executing' or 'done'"
echo ""
echo "Review the output above to confirm the fix is working."
