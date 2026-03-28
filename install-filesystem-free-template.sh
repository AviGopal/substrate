#!/bin/bash
# Install filesystem-free create-activity template manually

TEMPLATE_FILE="templates/bootstrap/create-activity-filesystem-free-minimal.json"
STORAGE_DIR="$HOME/.local/share/opencode/storage/activity-template"
BACKUP_DIR="$HOME/.local/share/opencode/storage/activity-template-backups"

echo "=== Installing Filesystem-Free create-activity Template ==="
echo ""

# Check template exists
if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "❌ Error: Template file not found: $TEMPLATE_FILE"
  exit 1
fi

echo "✓ Template file found: $TEMPLATE_FILE"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"
echo "✓ Backup directory ready: $BACKUP_DIR"

# Backup existing template if it exists
if [ -f "$STORAGE_DIR/create-activity.json" ]; then
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  cp "$STORAGE_DIR/create-activity.json" "$BACKUP_DIR/create-activity-$TIMESTAMP.json"
  echo "✓ Backed up existing template to: $BACKUP_DIR/create-activity-$TIMESTAMP.json"
else
  echo "ℹ No existing create-activity template to backup"
fi

# Ensure storage directory exists
mkdir -p "$STORAGE_DIR"

# Install new template
cp "$TEMPLATE_FILE" "$STORAGE_DIR/create-activity.json"
echo "✓ Installed new template to: $STORAGE_DIR/create-activity.json"
echo ""

# Verify
if [ -f "$STORAGE_DIR/create-activity.json" ]; then
  SIZE=$(wc -c < "$STORAGE_DIR/create-activity.json")
  TMP_COUNT=$(grep -c "/tmp" "$STORAGE_DIR/create-activity.json" || echo "0")
  TASK_COUNT=$(jq '.tasks | length' "$STORAGE_DIR/create-activity.json" 2>/dev/null || echo "unknown")
  
  echo "=== Installation Verification ==="
  echo "File size: $SIZE bytes"
  echo "Tasks: $TASK_COUNT"
  echo "/tmp references: $TMP_COUNT"
  echo ""
  
  if [ "$TMP_COUNT" = "0" ]; then
    echo "✅ SUCCESS: Filesystem-free template installed!"
    echo ""
    echo "The new template:"
    echo "  - Has NO /tmp references"
    echo "  - Uses impulse_create for intermediate data"
    echo "  - Validates against forbidden patterns"
    echo "  - Is ready to test"
    echo ""
    echo "Test it with:"
    echo "  opencode activity create-activity \\"
    echo "    --variables '{\"templateName\":\"test\",\"templateDescription\":\"A test\",\"category\":\"infrastructure\"}' \\"
    echo "    --reason 'Testing filesystem-free template'"
  else
    echo "⚠️  WARNING: Template still has /tmp references!"
  fi
else
  echo "❌ ERROR: Installation failed!"
  exit 1
fi
