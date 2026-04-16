#!/bin/bash

# Configuration Validation Test Script
# Validates devbob configuration functionality and writes success message to disk

echo "Starting configuration validation..."

# Check if config file exists
CONFIG_FILE="./configs/devbob-config.json"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Configuration file not found: $CONFIG_FILE"
    exit 1
fi
echo "✓ Configuration file found: $CONFIG_FILE"

# Validate JSON structure using basic checks
if ! grep -q '"metabob"' "$CONFIG_FILE"; then
    echo "❌ Missing 'metabob' section in configuration"
    exit 1
fi
echo "✓ Metabob section found"

if ! grep -q '"provider"' "$CONFIG_FILE"; then
    echo "❌ Missing 'provider' section in configuration"
    exit 1
fi
echo "✓ Provider section found"

if ! grep -q '"sessionMemory"' "$CONFIG_FILE"; then
    echo "❌ Missing 'sessionMemory' section in configuration"
    exit 1
fi
echo "✓ Session memory section found"

# Check for key configuration fields
if ! grep -q '"enabled"' "$CONFIG_FILE"; then
    echo "❌ Missing 'enabled' field in configuration"
    exit 1
fi
echo "✓ Enabled field found"

if ! grep -q '"api_key"' "$CONFIG_FILE"; then
    echo "❌ Missing 'api_key' field in configuration"
    exit 1
fi
echo "✓ API key field found"

# Check for feature flags
FEATURES=("activity_learning" "impulse_mapping" "development_metrics" "template_auto_registration")
echo ""
echo "Feature Status:"
for feature in "${FEATURES[@]}"; do
    if grep -q "\"$feature\"" "$CONFIG_FILE"; then
        echo "  ✓ $feature: CONFIGURED"
    else
        echo "  ✗ $feature: NOT FOUND"
    fi
done

# Count total configuration lines
TOTAL_LINES=$(wc -l < "$CONFIG_FILE")
echo ""
echo "Configuration file contains $TOTAL_LINES lines"

# Generate timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")

# Write success message to disk
SUCCESS_FILE="./config-validation-success.json"
cat > "$SUCCESS_FILE" << EOF
{
  "timestamp": "$TIMESTAMP",
  "status": "SUCCESS",
  "message": "Configuration validation completed successfully",
  "validated_sections": ["metabob", "provider", "sessionMemory"],
  "features_checked": ["activity_learning", "impulse_mapping", "development_metrics", "template_auto_registration"],
  "config_file": "$CONFIG_FILE",
  "config_lines": $TOTAL_LINES,
  "validation_method": "shell_script"
}
EOF

echo ""
echo "🎉 SUCCESS: Configuration validation passed!"
echo "📄 Success message written to: $SUCCESS_FILE"
echo ""
echo "Success file contents:"
cat "$SUCCESS_FILE"

exit 0