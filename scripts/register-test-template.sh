#!/bin/bash
# Register the test-metabob-stack-e2e activity template

set -e

TEMPLATE_FILE="templates/test-metabob-stack-e2e.json"

echo "Registering Metabob Stack E2E Test Template..."
echo ""

# Check if template file exists
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "❌ Template file not found: $TEMPLATE_FILE"
    exit 1
fi

echo "✓ Template file found: $TEMPLATE_FILE"

# Validate JSON
if ! jq empty "$TEMPLATE_FILE" 2>/dev/null; then
    echo "❌ Invalid JSON in template file"
    exit 1
fi

echo "✓ Template JSON is valid"

# Extract template name
TEMPLATE_NAME=$(jq -r '.name' "$TEMPLATE_FILE")
echo "✓ Template name: $TEMPLATE_NAME"

# Register template using OpenCode
echo ""
echo "Registering template with local storage..."

# Create a simple Node.js script to register the template
cat > /tmp/register-template.js << 'EOFJS'
const fs = require('fs');
const path = require('path');

const templateFile = process.argv[2];
const templateData = JSON.parse(fs.readFileSync(templateFile, 'utf8'));

// Generate template ID from name
const templateId = templateData.name;

console.log(`Template ID: ${templateId}`);
console.log(`Template Name: ${templateData.name}`);
console.log(`Category: ${templateData.category}`);
console.log(`Tasks: ${templateData.tasks.length}`);

// Save to local storage directory
const storageDir = path.join(process.env.HOME, '.local/share/opencode/storage/activity-template');
fs.mkdirSync(storageDir, { recursive: true });

const outputFile = path.join(storageDir, `${templateId}.json`);

// Add ID to template
templateData.id = templateId;
templateData.activity_id = templateId;

fs.writeFileSync(outputFile, JSON.stringify(templateData, null, 2));

console.log(`\n✓ Template registered: ${outputFile}`);
console.log(`\nYou can now use this template with:`);
console.log(`  opencode activity execute ${templateId} --variable testRunId=<id> ...`);

EOFJS

node /tmp/register-template.js "$TEMPLATE_FILE"

echo ""
echo "✅ Template registration complete!"
echo ""
echo "To use this template, run:"
echo "  opencode activity execute test-metabob-stack-e2e \\"
echo "    --variable testRunId=e2e-test-$(date +%Y%m%d-%H%M%S) \\"
echo "    --variable redisTestInput='Hello Redis' \\"
echo "    --variable surrealTestActivityName='test-activity' \\"
echo "    --variable surrealTestStatus='pending' \\"
echo "    --variable surrealTestInput='Test data' \\"
echo "    --variable acpTestInput='Echo this message' \\"
echo "    --variable acpTestValue1='value1' \\"
echo "    --variable acpTestValue2='value2' \\"
echo "    --variable e2eTestPrompt='Complete workflow test'"
